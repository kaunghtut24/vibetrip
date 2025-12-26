export enum AgentStatus {
  IDLE = 'IDLE',
  PARSING_INTENT = 'PARSING_INTENT',
  REVIEW_INTENT = 'REVIEW_INTENT',
  DISCOVERY = 'DISCOVERY',
  REVIEW_DISCOVERY = 'REVIEW_DISCOVERY',
  OPTIMIZING = 'OPTIMIZING',
  RENDERING = 'RENDERING',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export interface AgentResponseMetadata {
  confidenceScore: number;
  assumptions: string[];
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Travelers {
  adults: number;
  children: number;
  seniors: number;
}

export interface CurrencyInfo {
  code: string;
  symbol: string;
  rateToUSD: number; // 1 USD = x Local
}

export interface UserPreferences {
  pace: 'Relaxed' | 'Moderate' | 'Fast Paced';
  budgetTier: 'Budget' | 'Moderate' | 'Luxury';
  accessibility: string[];
  dietaryRestrictions: string[];
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  preferences: UserPreferences;
  tripHistory: string[]; // IDs of past trips
}

export interface TripIntent extends AgentResponseMetadata {
  destination: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  budgetLevel: 'Budget' | 'Moderate' | 'Luxury';
  travelers: Travelers;
  vibes: string[];
  constraints: string[];
  // Map of Currency Code -> Info (e.g. { "JPY": { ...rate: 150 } })
  currencyRates: Record<string, CurrencyInfo>; 
}

export interface Place {
  name: string;
  description: string;
  type: 'Activity' | 'Food' | 'Hotel' | 'Landmark';
  coordinates?: Coordinates;
  estimatedCost: string;
  currencyCode?: string; // The specific currency for this place
  bookingUrl?: string;
  imageUrl?: string;
  rating?: number;
  address?: string;
}

export interface Flight {
  id: string;
  airline: string;
  flightNumber: string;
  departureTime: string; // ISO
  arrivalTime: string; // ISO
  origin: string;
  destination: string;
  price: string;
  bookingUrl?: string;
}

export interface DiscoveryResult extends AgentResponseMetadata {
  activities: Place[];
  dining: Place[];
  accommodations: Place[];
  flights?: Flight[];
}

export interface DayPlan {
  day: number;
  title: string;
  morning: Place[];
  afternoon: Place[];
  evening: Place[];
  totalEstimatedCost: number;
}

export interface PlanReasoning {
  vibeAnalysis: { vibe: string; matchedActivities: string[] }[];
  constraintLog: string[];
  selectedAssumptions: string[];
}

export interface Itinerary {
  id: string;
  title: string;
  description: string;
  tags: string[];
  totalEstimatedCost: number;
  currency: string;
  days: DayPlan[];
  reasoning?: PlanReasoning;
}

export interface OptimizationResult extends AgentResponseMetadata {
  itineraries: Itinerary[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Versioned Trip Store Model
export interface Trip {
  id: string;
  userId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'confirmed' | 'booked';
  
  // Trip Data
  intent: TripIntent;
  discovery: DiscoveryResult | null;
  optimizedPlans: Itinerary[];
  selectedPlanId?: string;
}