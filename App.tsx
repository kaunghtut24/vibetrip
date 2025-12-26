import React, { useState, useEffect } from 'react';
import ChatInterface from './components/ChatInterface';
import AgentStatusVisualizer from './components/AgentStatus';
import ItineraryView, { ModificationType } from './components/ItineraryView';
import ConfidenceCheck from './components/ConfidenceCheck';
import DebugPanel from './components/DebugPanel';
import UserProfileModal from './components/UserProfileModal';
import { AgentStatus, ChatMessage, Itinerary, TripIntent, DiscoveryResult, UserProfile } from './types';
import { parseIntentAgent, discoveryAgent, optimizationAgent, refineItineraryAgent } from './services/gemini';
import { saveTrip, getUserProfile, saveUserProfile } from './services/firestore_mock';
import { pluginRegistry } from './services/plugins/registry';
import { PluginStage } from './services/plugins/types';

const App: React.FC = () => {
  const [status, setStatus] = useState<AgentStatus>(AgentStatus.IDLE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [itineraries, setItineraries] = useState<Itinerary[] | null>(null);
  
  // User Profile State
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Workflow State Data
  const [intent, setIntent] = useState<TripIntent | null>(null);
  const [discoveryResult, setDiscoveryResult] = useState<DiscoveryResult | null>(null);
  
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [isModifying, setIsModifying] = useState(false);

  // Initial Load (Profile & Greeting)
  useEffect(() => {
    const initApp = async () => {
        // Load default guest profile
        const profile = await getUserProfile('user_guest');
        setUserProfile(profile);

        setMessages([
            {
                id: 'welcome',
                role: 'assistant',
                content: `Hi ${profile?.name.split(' ')[0] || 'there'}! I'm VibeTrip. I can plan your entire journey based on your preferences. Where are you dreaming of going?`,
                timestamp: Date.now()
            }
        ]);
    };
    initApp();
  }, []);

  const handleSaveProfile = async (updatedProfile: UserProfile) => {
      await saveUserProfile(updatedProfile);
      setUserProfile(updatedProfile);
      setMessages(prev => [...prev, {
          id: Date.now().toString(),
          role: 'system',
          content: 'Profile updated! I will use these preferences for your next trip.',
          timestamp: Date.now()
      }]);
  };

  const shouldRequireConfirmation = (score: number, assumptions: string[]) => {
    return score < 0.7 || assumptions.length > 0;
  };

  // Helper to process plugin results and add them to chat
  const processPluginResults = (results: any[]) => {
    results.forEach(res => {
        if (res.message) {
            setMessages(prev => [...prev, {
                id: `plugin-${Date.now()}-${Math.random()}`,
                role: 'system', // Use system role for plugin alerts
                content: res.message,
                timestamp: Date.now()
            }]);
        }
    });
  };

  const handleSendMessage = async (text: string) => {
    // 1. User Message
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    
    // 2. Start Workflow: Intent Parsing
    setStatus(AgentStatus.PARSING_INTENT);
    
    try {
      const history = messages.map(m => `${m.role}: ${m.content}`).join('\n') + `\nuser: ${text}`;
      
      // Pass user profile to agent to use as defaults
      const parsedIntent = await parseIntentAgent(history, userProfile);
      setIntent(parsedIntent);

      // --- PLUGIN HOOK: POST_INTENT ---
      const pluginResults = await pluginRegistry.runStage(PluginStage.POST_INTENT, { intent: parsedIntent });
      processPluginResults(pluginResults);
      // --------------------------------

      if (shouldRequireConfirmation(parsedIntent.confidenceScore, parsedIntent.assumptions)) {
        setStatus(AgentStatus.REVIEW_INTENT);
      } else {
        // Auto-proceed if high confidence
        proceedToDiscovery(parsedIntent);
      }

    } catch (error: any) {
      handleError(error);
    }
  };

  // --- Step 2: Discovery Logic ---
  const proceedToDiscovery = async (currentIntent: TripIntent) => {
    setStatus(AgentStatus.DISCOVERY);
    
    // Add confirmation message to chat
    const totalTravelers = currentIntent.travelers.adults + currentIntent.travelers.children + currentIntent.travelers.seniors;
    const confirmMsg: ChatMessage = { 
        id: Date.now().toString() + 'r', 
        role: 'assistant', 
        content: `Got it! Planning a ${currentIntent.budgetLevel} trip to ${currentIntent.destination} for ${totalTravelers} people. Checking availability...`, 
        timestamp: Date.now() 
    };
    setMessages(prev => [...prev, confirmMsg]);

    try {
        const result = await discoveryAgent(currentIntent);
        setDiscoveryResult(result);

        // --- PLUGIN HOOK: POST_DISCOVERY ---
        const pluginResults = await pluginRegistry.runStage(PluginStage.POST_DISCOVERY, { intent: currentIntent, discovery: result });
        processPluginResults(pluginResults);
        // -----------------------------------

        if (shouldRequireConfirmation(result.confidenceScore, result.assumptions)) {
            setStatus(AgentStatus.REVIEW_DISCOVERY);
        } else {
            proceedToOptimization(currentIntent, result);
        }
    } catch (error: any) {
        handleError(error);
    }
  };

  // --- Step 3: Optimization Logic ---
  const proceedToOptimization = async (currentIntent: TripIntent, discovery: DiscoveryResult) => {
    setStatus(AgentStatus.OPTIMIZING);
    try {
        const result = await optimizationAgent(currentIntent, discovery);
        
        setStatus(AgentStatus.RENDERING);
        await new Promise(r => setTimeout(r, 800)); // UI pacing
        
        setItineraries(result.itineraries);

        // --- PLUGIN HOOK: POST_OPTIMIZATION ---
        const pluginResults = await pluginRegistry.runStage(PluginStage.POST_OPTIMIZATION, { intent: currentIntent, discovery, itineraries: result.itineraries });
        processPluginResults(pluginResults);
        // --------------------------------------
        
        // If optimization had low confidence (or was a fallback), we show a warning message in the chat
        if (shouldRequireConfirmation(result.confidenceScore, result.assumptions)) {
             setMessages(prev => [...prev, {
                id: Date.now().toString(),
                role: 'assistant',
                content: `I've generated the plans, but I had to make some best-guesses: ${result.assumptions.join(", ")}.`,
                timestamp: Date.now()
             }]);
        }
        
        setStatus(AgentStatus.COMPLETE);
    } catch (error: any) {
        handleError(error);
    }
  };

  // --- Itinerary Modification Logic ---
  const handleModifyItinerary = async (type: ModificationType, payload: any) => {
    if (!itineraries || !discoveryResult || !intent) return;
    
    setIsModifying(true);

    try {
      if (type === 'REOPTIMIZE') {
        // Global Change: Update Intent -> Re-run Optimization
        const updatedIntent = { ...intent };
        if (payload.pace === 'Relaxed') {
            updatedIntent.vibes = [...updatedIntent.vibes.filter(v => v !== 'Fast Paced'), 'Relaxed', 'Chill'];
        } else if (payload.pace === 'Active') {
            updatedIntent.vibes = [...updatedIntent.vibes.filter(v => v !== 'Relaxed'), 'Active', 'Fast Paced'];
        } else if (payload.pace === 'Budget') {
            updatedIntent.budgetLevel = 'Budget';
            updatedIntent.vibes = [...updatedIntent.vibes, 'Budget Friendly', 'Free Activities'];
        }
        
        setIntent(updatedIntent);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: `Adjusting plan for ${payload.pace} style...`,
            timestamp: Date.now()
        }]);

        await proceedToOptimization(updatedIntent, discoveryResult);
      
      } else {
        // Granular Change: Swap or Regen Day
        const targetItinerary = itineraries.find(it => it.id === payload.itineraryId);
        if (!targetItinerary) return;

        let instruction = "";
        if (type === 'SWAP') {
            instruction = `Swap the activity '${payload.placeName}' on Day ${payload.day} (${payload.timeOfDay}) with a suitable alternative.`;
        } else if (type === 'REGEN_DAY') {
            instruction = `Completely regenerate Day ${payload.day} with different activities.`;
        }

        const updatedItinerary = await refineItineraryAgent(targetItinerary, instruction, discoveryResult);
        
        // Update state by replacing the old itinerary
        setItineraries(prev => prev ? prev.map(it => it.id === payload.itineraryId ? updatedItinerary : it) : null);
      }

    } catch (error: any) {
        console.error(error);
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: 'assistant',
            content: "I'm having trouble making that specific change right now. Please try again in a moment.",
            timestamp: Date.now()
        }]);
    } finally {
        setIsModifying(false);
    }
  };

  // --- Workflow Handlers ---

  const handleIntentConfirm = () => {
    if (intent) proceedToDiscovery(intent);
  };

  const handleDiscoveryConfirm = () => {
    if (intent && discoveryResult) proceedToOptimization(intent, discoveryResult);
  };

  const handleCancelWorkflow = () => {
    setStatus(AgentStatus.IDLE);
    setIntent(null);
    setDiscoveryResult(null);
    setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Okay, I've paused the plan. Please provide more specific details so I can be more confident.",
        timestamp: Date.now()
    }]);
  };

  const handleError = (error: any) => {
    console.error(error);
    setStatus(AgentStatus.ERROR);
    let errorMessage = "I encountered a technical glitch. Please try again.";
    
    // Extract meaningful messages from our custom error handling
    if (error.message) {
        if (error.message.includes("couldn't quite catch")) errorMessage = error.message;
        else if (error.message.includes("timed out")) errorMessage = "The travel database is taking longer than expected. Please try again.";
        else if (error.message.includes("high traffic")) errorMessage = "We are experiencing high traffic. Please wait a moment and try again.";
    }
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'assistant',
      content: errorMessage,
      timestamp: Date.now()
    }]);
    setStatus(AgentStatus.IDLE);
  };

  const handleConfirmTrip = async () => {
    if (!intent || !itineraries) return;
    
    // Save the trip using the new versioned store
    await saveTrip({
      id: `trip_${Date.now()}`,
      userId: userProfile?.id || 'user_guest',
      status: 'confirmed',
      intent: intent,
      discovery: discoveryResult,
      optimizedPlans: itineraries,
      selectedPlanId: itineraries[0].id // Defaulting to first for now, assuming ItineraryView handles selection
    });
    
    setIsConfirmed(true);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <i className="fa-solid fa-paper-plane text-blue-600 text-xl"></i>
              <span className="font-bold text-xl tracking-tight text-gray-900">VibeTrip<span className="text-blue-600">.AI</span></span>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden md:flex items-center gap-2 text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                Vertex AI Agent Active
              </div>
              <button 
                onClick={() => setIsProfileOpen(true)}
                className="flex items-center gap-2 text-gray-600 hover:text-blue-600 transition-colors bg-gray-50 hover:bg-blue-50 px-3 py-1.5 rounded-lg"
              >
                <div className="w-6 h-6 rounded-full bg-gray-300 overflow-hidden">
                    {/* Simple avatar placeholder */}
                    <div className="w-full h-full bg-gradient-to-br from-blue-400 to-indigo-600"></div>
                </div>
                <span className="text-sm font-medium hidden sm:block">{userProfile?.name || 'Guest'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 sm:px-6 lg:px-8 py-6 overflow-hidden">
        <div className="max-w-[1800px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
          
          {/* Left Column: Chat & Status */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            <AgentStatusVisualizer status={status} />
            <ChatInterface 
              messages={messages} 
              onSendMessage={handleSendMessage} 
              status={status}
            />
            
            {/* Confidence Check Overlays for Steps */}
            {status === AgentStatus.REVIEW_INTENT && intent && (
                <ConfidenceCheck 
                    agentName="Intent Parser"
                    score={intent.confidenceScore}
                    assumptions={intent.assumptions}
                    onConfirm={handleIntentConfirm}
                    onCancel={handleCancelWorkflow}
                />
            )}

            {status === AgentStatus.REVIEW_DISCOVERY && discoveryResult && (
                <ConfidenceCheck 
                    agentName="Discovery Agent"
                    score={discoveryResult.confidenceScore}
                    assumptions={discoveryResult.assumptions}
                    onConfirm={handleDiscoveryConfirm}
                    onCancel={handleCancelWorkflow}
                />
            )}

            {intent && (status !== AgentStatus.REVIEW_INTENT) && (
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-5 rounded-xl border-2 border-blue-200 shadow-md animate-fade-in">
                <h4 className="text-xs font-bold text-blue-700 uppercase mb-4 flex items-center gap-2">
                  <i className="fa-solid fa-circle-info"></i>
                  Trip Context
                </h4>
                <div className="space-y-3 text-sm">
                   <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                     <span className="text-gray-600 font-semibold flex items-center gap-2">
                       <i className="fa-solid fa-location-dot text-blue-600"></i>
                       Destination
                     </span>
                     <span className="font-bold text-gray-800 text-right">{intent.destination}</span>
                   </div>
                   <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                     <span className="text-gray-600 font-semibold flex items-center gap-2">
                       <i className="fa-solid fa-calendar-days text-blue-600"></i>
                       Duration
                     </span>
                     <span className="font-bold text-gray-800">{intent.durationDays} Days</span>
                   </div>
                   <div className="flex justify-between items-center bg-white/60 px-3 py-2 rounded-lg">
                     <span className="text-gray-600 font-semibold flex items-center gap-2">
                       <i className="fa-solid fa-users text-blue-600"></i>
                       Travelers
                     </span>
                     <span className="font-bold text-gray-800">
                       {intent.travelers.adults} Adults, {intent.travelers.children} Children
                     </span>
                   </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Results */}
          <div className="lg:col-span-8">
            {itineraries ? (
              <ItineraryView 
                itineraries={itineraries} 
                onConfirm={handleConfirmTrip}
                isConfirmed={isConfirmed}
                onModify={handleModifyItinerary}
                isModifying={isModifying}
              />
            ) : (
              <div className="h-full min-h-[500px] flex flex-col items-center justify-center bg-white rounded-2xl border border-dashed border-gray-300 text-gray-400">
                <div className="w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                  <i className="fa-solid fa-map-location-dot text-3xl opacity-20"></i>
                </div>
                <h3 className="text-lg font-medium text-gray-900">No Itinerary Yet</h3>
                <p className="max-w-xs text-center mt-2">Start chatting with the agent to generate your personalized travel plan.</p>
              </div>
            )}
          </div>
        </div>
        </div>
      </main>

      <DebugPanel />
      
      {/* Profile Modal */}
      {userProfile && (
        <UserProfileModal 
            isOpen={isProfileOpen} 
            onClose={() => setIsProfileOpen(false)}
            profile={userProfile}
            onSave={handleSaveProfile}
        />
      )}
    </div>
  );
};

export default App;