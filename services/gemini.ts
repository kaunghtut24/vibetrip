import { Type } from "@google/genai";
import { Itinerary, TripIntent, DiscoveryResult, Place, OptimizationResult, DayPlan, CurrencyInfo, UserProfile } from "../types";
import { z } from "zod";
import { estimateActivityCost } from "./costEstimator";
import { agentLogger } from "./logger";

// --- UTILITIES: RESILIENCE & RETRY ---

const CONFIG = {
  RETRIES: 2,
  TIMEOUT_MS: 30000, // 30 seconds per attempt (increased for complex operations)
  BACKOFF_BASE_MS: 1000,
  // Different timeouts for different agents
  INTENT_TIMEOUT_MS: 15000,      // IntentParser: 15s
  DISCOVERY_TIMEOUT_MS: 20000,   // DiscoveryAgent: 20s
  OPTIMIZATION_TIMEOUT_MS: 45000, // OptimizationAgent: 45s (most complex)
  REFINE_TIMEOUT_MS: 30000       // RefineAgent: 30s
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Executes an async operation with timeout and exponential backoff.
 */
async function runWithRetry<T>(
  operationName: string,
  fn: () => Promise<T>,
  retries = CONFIG.RETRIES,
  timeoutMs = CONFIG.TIMEOUT_MS
): Promise<T> {
  let lastError: any;

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${operationName} timed out after ${timeoutMs}ms`)), timeoutMs)
      );

      return await Promise.race([fn(), timeoutPromise]);
    } catch (error: any) {
      lastError = error;
      const isLastAttempt = attempt > retries;
      
      console.warn(`[${operationName}] Attempt ${attempt}/${retries + 1} failed: ${error.message}`);
      
      if (!isLastAttempt) {
        // Exponential backoff: 1s, 2s, 4s...
        const backoff = CONFIG.BACKOFF_BASE_MS * Math.pow(2, attempt - 1);
        await wait(backoff);
      }
    }
  }
  
  // Enhance error message for UI
  throw new Error(`We're experiencing high traffic. ${operationName} failed after multiple attempts. (${lastError.message})`);
}

// --- BACKEND BRIDGE: GEMINI VIA NODE SERVER ---

const GEMINI_API_BASE = "/api/gemini";

interface BackendGenerateRequest {
	model: string;
	contents: any;
	config?: any;
}

async function callGeminiGenerate({ model, contents, config }: BackendGenerateRequest): Promise<string> {
	const response = await fetch(`${GEMINI_API_BASE}/generate`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ model, contents, config }),
	});

	if (!response.ok) {
		let message = `Gemini backend error: ${response.status}`;
		let errorDetails: any = null;

		try {
			const errBody = await response.json();
			errorDetails = errBody;

			// Handle different error response formats
			if (errBody && typeof errBody.error === "string") {
				message = errBody.error;
			} else if (errBody && typeof errBody.error === "object") {
				// Gemini API returns detailed error objects
				const apiError = errBody.error;
				if (apiError.message) {
					message = apiError.message;
				}
				if (apiError.code) {
					message = `[${apiError.code}] ${message}`;
				}
			} else if (errBody && errBody.message) {
				message = errBody.message;
			}
		} catch {
			// ignore JSON parse failure
		}

		const error: any = new Error(message);
		error.details = errorDetails;
		throw error;
	}

	const data = await response.json();
	if (!data || typeof data.text !== "string") {
		throw new Error("Gemini backend returned invalid response");
	}
	return data.text;
}

/**
 * Fallback Generator for Optimization Agent.
 * Used when the LLM fails to structure the itinerary but we have valid candidates.
 */
const generateFallbackItinerary = (intent: TripIntent, discovery: DiscoveryResult): OptimizationResult => {
  const days: DayPlan[] = [];
  const { activities, dining } = discovery;

  // Pick first available currency from intent
  const primaryCurrencyCode = Object.keys(intent.currencyRates)[0] || 'USD';

  // Simple round-robin distribution
  for (let i = 1; i <= intent.durationDays; i++) {
    // Safe access with modulo
    const morning = activities.length > 0 ? [activities[(i - 1) % activities.length]] : [];
    const afternoon = activities.length > 1 ? [activities[(i + Math.floor(activities.length / 2)) % activities.length]] : [];
    const evening = dining.length > 0 ? [dining[(i - 1) % dining.length]] : [];

    days.push({
      day: i,
      title: `Day ${i}: Highlights of ${intent.destination}`,
      morning,
      afternoon,
      evening,
      totalEstimatedCost: 0 // Fallback doesn't recalculate strict totals
    });
  }

  const fallbackItinerary: Itinerary = {
    id: `fallback_${Date.now()}`,
    title: "Essential Trip Plan (Auto-Generated)",
    description: "A streamlined itinerary based on your top interests. (Generated via fallback logic due to high demand)",
    tags: ["Simple", "Highlights"],
    totalEstimatedCost: 0,
    currency: primaryCurrencyCode,
    days: days,
    reasoning: {
      vibeAnalysis: [],
      constraintLog: ["Optimization service was busy, applied standard distribution logic."],
      selectedAssumptions: ["Standard pacing applied", "Selected top rated candidates"]
    }
  };

  return {
    itineraries: [fallbackItinerary],
    confidenceScore: 0.2, // Low confidence triggers "ConfidenceCheck" in UI
    assumptions: ["System fallback: Simple logic used due to AI timeout."]
  };
};


// --- Zod Schema Definitions ---

export const IntentZodSchema = z.object({
  destination: z.string().min(1, "Destination is required"),
  startDate: z.string().nullable(),
  endDate: z.string().nullable(),
  durationDays: z.number().int().min(1).default(3),
  budgetLevel: z.enum(["Budget", "Moderate", "Luxury"]),
  travelers: z.object({
    adults: z.number().int().min(1).default(1),
    children: z.number().int().min(0).default(0),
    seniors: z.number().int().min(0).default(0),
  }),
  vibes: z.array(z.string()),
  constraints: z.array(z.string()),
  confidenceScore: z.number().min(0).max(1),
  assumptions: z.array(z.string()),
  // API returns array, we transform to Record
  currencies: z.array(z.object({
      code: z.string(),
      symbol: z.string(),
      rateToUSD: z.number()
  })).optional()
});

/**
 * AGENT 1: INTENT PARSER
 * Extracts structured data from natural language chat with strict Zod validation.
 */
export const parseIntentAgent = async (chatHistory: string, userProfile?: UserProfile | null): Promise<TripIntent> => {
  const logId = agentLogger.start("IntentParser", { chatHistory, userProfile });
  const model = "gemini-2.5-flash-preview-09-2025";
  
  // Construct profile context string
  const profileContext = userProfile ? `
    USER PROFILE DEFAULTS (Apply these unless explicitly overridden in chat):
    - Preferred Pace: ${userProfile.preferences.pace}
    - Default Budget: ${userProfile.preferences.budgetTier}
    - Accessibility Needs: ${userProfile.preferences.accessibility.join(", ") || "None"}
    - Dietary Restrictions: ${userProfile.preferences.dietaryRestrictions.join(", ") || "None"}
    
    If Accessibility Needs are present, add them to the 'constraints' list.
    If Pace is specified, add it to 'vibes'.
  ` : "";

  const systemInstruction = `
    You are an expert Travel Intent Parser. 
    Analyze the conversation history and extract the current trip details into strictly formatted JSON.
    
    ${profileContext}

    Rules:
    - Extract specific details: Destination, Dates, Duration, Budget, Travelers, Vibes, and Constraints.
    - If details are missing, make reasonable assumptions based on the User Profile Defaults first, then general logic.
    - **Currency Detection**: Identify the local currency for the destination(s). 
      - Provide the ISO code (e.g., 'JPY').
      - Provide the symbol (e.g., '¥').
      - Provide an **approximate** exchange rate: How many of the Local Currency equals 1 USD? (e.g., JPY rateToUSD = 150).
      - If multiple countries, provide rates for all of them.
    - **CRITICAL**: Populate the 'assumptions' array with every guess you made.
    - **CRITICAL**: Provide a 'confidenceScore' (0.0 to 1.0).
    - Return strictly JSON matching the requested schema.
  `;

  const apiSchema = {
    type: Type.OBJECT,
    properties: {
      destination: { type: Type.STRING },
      startDate: { type: Type.STRING, description: "YYYY-MM-DD or null" },
      endDate: { type: Type.STRING, description: "YYYY-MM-DD or null" },
      durationDays: { type: Type.INTEGER },
      budgetLevel: { type: Type.STRING, enum: ["Budget", "Moderate", "Luxury"] },
      travelers: {
        type: Type.OBJECT,
        properties: {
          adults: { type: Type.INTEGER },
          children: { type: Type.INTEGER },
          seniors: { type: Type.INTEGER },
        }
      },
      vibes: { type: Type.ARRAY, items: { type: Type.STRING } },
      constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
      confidenceScore: { type: Type.NUMBER, description: "0.0 to 1.0" },
      assumptions: { type: Type.ARRAY, items: { type: Type.STRING } },
      currencies: {
        type: Type.ARRAY,
        description: "Array of currencies for the destination(s). Example: [{code:'EUR', symbol:'€', rateToUSD: 0.92}]",
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING, description: "ISO currency code (e.g. 'EUR', 'JPY')" },
            symbol: { type: Type.STRING, description: "Currency symbol (e.g. '€', '¥')" },
            rateToUSD: { type: Type.NUMBER, description: "Exchange rate: 1 USD = X local currency" },
          },
          required: ['code', 'symbol', 'rateToUSD'],
        },
      }
    },
    required: ["destination", "durationDays", "budgetLevel", "travelers", "vibes", "confidenceScore", "assumptions", "currencies"]
  };

  try {
    const result = await runWithRetry(
      "IntentParser",
      async () => {
        const text = await callGeminiGenerate({
          model,
          contents: `History: ${chatHistory}\n\nExtract the trip intent.`,
          config: {
            systemInstruction,
            responseMimeType: "application/json",
            responseSchema: apiSchema
          }
        });

        const parsedJson = JSON.parse(text);

        // Validate with Zod
        const validationResult = IntentZodSchema.safeParse(parsedJson);

        if (!validationResult.success) {
          throw new Error(`Validation Error: ${validationResult.error.errors[0]?.message}`);
        }

        // Transform currencies array to currencyRates Record
        const data = validationResult.data;
        const currencyRates: Record<string, { code: string; symbol: string; rateToUSD: number }> = {};
        if (data.currencies && Array.isArray(data.currencies)) {
          for (const curr of data.currencies) {
            currencyRates[curr.code] = curr;
          }
        }
        // Default to USD if no currencies detected
        if (Object.keys(currencyRates).length === 0) {
          currencyRates['USD'] = { code: 'USD', symbol: '$', rateToUSD: 1 };
        }

        // Return with transformed currencyRates
        const { currencies, ...rest } = data;
        return { ...rest, currencyRates } as TripIntent;
      },
      CONFIG.RETRIES,
      CONFIG.INTENT_TIMEOUT_MS
    );

    agentLogger.success(logId, result, result.confidenceScore);
    return result;

  } catch (error: any) {
    agentLogger.error(logId, error);
    if (error.message.includes("Validation Error") || error.message.includes("JSON")) {
       throw new Error("I couldn't quite catch the details of your trip. Could you please clarify where you want to go and for how long?");
    }
    throw error;
  }
};

/**
 * AGENT 2: DISCOVERY AGENT
 * Retrieves a raw list of candidates (places, hotels, dining) based on intent.
 */
export const discoveryAgent = async (intent: TripIntent): Promise<DiscoveryResult> => {
  const logId = agentLogger.start("DiscoveryAgent", intent);
  const model = "gemini-2.5-flash-preview-09-2025"; 

  const placeSchema = {
    type: Type.OBJECT,
    properties: {
      name: { type: Type.STRING },
      description: { type: Type.STRING },
      type: { type: Type.STRING, enum: ['Activity', 'Food', 'Hotel', 'Landmark'] },
      estimatedCost: { type: Type.STRING }, 
      currencyCode: { type: Type.STRING, description: "ISO code of currency for this place" },
      coordinates: {
        type: Type.OBJECT,
        properties: {
          lat: { type: Type.NUMBER },
          lng: { type: Type.NUMBER },
        }
      }
    }
  };

  const schema = {
    type: Type.OBJECT,
    properties: {
      activities: { type: Type.ARRAY, items: placeSchema },
      dining: { type: Type.ARRAY, items: placeSchema },
      accommodations: { type: Type.ARRAY, items: placeSchema },
      confidenceScore: { type: Type.NUMBER, description: "0.0 to 1.0" },
      assumptions: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["activities", "dining", "accommodations", "confidenceScore", "assumptions"]
  };

  try {
    const result = await runWithRetry(
      "DiscoveryAgent",
      async () => {
        const text = await callGeminiGenerate({
          model,
          contents: `Find candidates for a ${intent.durationDays}-day trip to ${intent.destination}. Budget: ${intent.budgetLevel}. Vibe: ${intent.vibes.join(", ")}. Provide approximate lat/lng coordinates and local currency code for each place.`,
          config: {
            systemInstruction: "You are an expert Travel Scout. Find specific, real places.",
            responseMimeType: "application/json",
            responseSchema: schema
          }
        });

        return JSON.parse(text) as DiscoveryResult;
      },
      CONFIG.RETRIES,
      CONFIG.DISCOVERY_TIMEOUT_MS
    );

    // --- ENRICHMENT LAYER ---
    const enrichPlaceWithCost = (place: Place) => {
      // 1. Resolve Currency for this place
      // Default to the first detected currency if place currency is missing or unknown
      const placeCurrencyCode = place.currencyCode || Object.keys(intent.currencyRates)[0];
      const currencyInfo = intent.currencyRates[placeCurrencyCode] || { code: 'USD', symbol: '$', rateToUSD: 1 };
      
      // 2. Estimate
      const estimation = estimateActivityCost(
          place.type, 
          intent.destination, 
          intent.budgetLevel, 
          currencyInfo
      );
      
      place.estimatedCost = estimation.formatted;
      place.currencyCode = currencyInfo.code;
    };

    if (result.activities) result.activities.forEach(enrichPlaceWithCost);
    if (result.dining) result.dining.forEach(enrichPlaceWithCost);
    if (result.accommodations) result.accommodations.forEach(enrichPlaceWithCost);

    agentLogger.success(logId, result, result.confidenceScore);
    return result;

  } catch (error) {
    agentLogger.error(logId, error);
    throw error;
  }
};

/**
 * AGENT 3: OPTIMIZATION AGENT
 * Takes the raw candidates from Discovery and sequences them into logical itineraries.
 */
export const optimizationAgent = async (intent: TripIntent, candidates: DiscoveryResult): Promise<OptimizationResult> => {
  const logId = agentLogger.start("OptimizationAgent", { intent, candidates });
  // Use gemini-2.5-flash for optimization
  const model = "gemini-2.5-flash";
  
  const itinerarySchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        totalEstimatedCost: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        reasoning: {
          type: Type.OBJECT,
          properties: {
            vibeAnalysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { vibe: { type: Type.STRING }, matchedActivities: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
            constraintLog: { type: Type.ARRAY, items: { type: Type.STRING } },
            selectedAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER },
              title: { type: Type.STRING },
              morning: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING }, estimatedCost: { type: Type.STRING }, currencyCode: { type: Type.STRING }, imageUrl: { type: Type.STRING }, coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } } } } },
              afternoon: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING }, estimatedCost: { type: Type.STRING }, currencyCode: { type: Type.STRING }, imageUrl: { type: Type.STRING }, coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } } } } },
              evening: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING }, estimatedCost: { type: Type.STRING }, currencyCode: { type: Type.STRING }, imageUrl: { type: Type.STRING }, coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } } } } },
              totalEstimatedCost: { type: Type.NUMBER }
            }
          }
        }
    }
  };

  const schema = {
    type: Type.OBJECT,
    properties: {
        itineraries: { type: Type.ARRAY, items: itinerarySchema },
        confidenceScore: { type: Type.NUMBER, description: "0.0 to 1.0" },
        assumptions: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["itineraries", "confidenceScore", "assumptions"]
  };

  try {
    const result = await runWithRetry(
      "OptimizationAgent",
      async () => {
        const text = await callGeminiGenerate({
          model,
          contents: `Plan a ${intent.durationDays}-day trip to ${intent.destination} using these candidates: ${JSON.stringify(candidates)}`,
          config: {
            systemInstruction: "Create 2 variants (Balanced, Hidden Gems). Use provided candidates. Preserve Coordinates and Currency. Calculate totals in the local currency.",
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });
        return JSON.parse(text) as OptimizationResult;
      },
      CONFIG.RETRIES,
      CONFIG.OPTIMIZATION_TIMEOUT_MS // Use longer timeout for optimization
    );

    agentLogger.success(logId, result, result.confidenceScore);
    return result;

  } catch (error) {
    // FALLBACK LOGIC
    console.error("Optimization failed, switching to fallback...", error);
    agentLogger.error(logId, { message: "Optimization Failed, using fallback", originalError: error });
    return generateFallbackItinerary(intent, candidates);
  }
};

/**
 * AGENT 4: REFINE ITINERARY AGENT
 * Handles granular updates to an existing itinerary (Swap, Regenerate Day, etc.)
 */
export const refineItineraryAgent = async (
  currentItinerary: Itinerary, 
  instruction: string, 
  candidates: DiscoveryResult
): Promise<Itinerary> => {
  const logId = agentLogger.start("RefineItineraryAgent", { instruction, currentItineraryId: currentItinerary.id });
  // Use faster model for refine operations
  const model = "gemini-2.0-flash-exp";

  const itinerarySchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        tags: { type: Type.ARRAY, items: { type: Type.STRING } },
        totalEstimatedCost: { type: Type.NUMBER },
        currency: { type: Type.STRING },
        reasoning: {
          type: Type.OBJECT,
          properties: {
            vibeAnalysis: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { vibe: { type: Type.STRING }, matchedActivities: { type: Type.ARRAY, items: { type: Type.STRING } } } } },
            constraintLog: { type: Type.ARRAY, items: { type: Type.STRING } },
            selectedAssumptions: { type: Type.ARRAY, items: { type: Type.STRING } }
          }
        },
        days: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              day: { type: Type.INTEGER },
              title: { type: Type.STRING },
              morning: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING }, estimatedCost: { type: Type.STRING }, currencyCode: { type: Type.STRING }, imageUrl: { type: Type.STRING }, coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } } } } },
              afternoon: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING }, estimatedCost: { type: Type.STRING }, currencyCode: { type: Type.STRING }, imageUrl: { type: Type.STRING }, coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } } } } },
              evening: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING }, type: { type: Type.STRING }, estimatedCost: { type: Type.STRING }, currencyCode: { type: Type.STRING }, imageUrl: { type: Type.STRING }, coordinates: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } } } } } },
              totalEstimatedCost: { type: Type.NUMBER }
            }
          }
        }
    }
  };

  try {
    const result = await runWithRetry(
      "RefineItineraryAgent",
      async () => {
        const text = await callGeminiGenerate({
          model,
          contents: `Current Itinerary: ${JSON.stringify(currentItinerary)}\nUser Instruction: ${instruction}\nAvailable Candidates: ${JSON.stringify(candidates)}`,
          config: {
            systemInstruction: "Edit itinerary based on request. Maintain structure. Include coordinates and currency codes.",
            responseMimeType: "application/json",
            responseSchema: itinerarySchema
          }
        });
        return JSON.parse(text) as Itinerary;
      },
      CONFIG.RETRIES,
      CONFIG.REFINE_TIMEOUT_MS
    );

    agentLogger.success(logId, result, 1.0);
    return result;

  } catch (error) {
    agentLogger.error(logId, error);
    throw error;
  }
};