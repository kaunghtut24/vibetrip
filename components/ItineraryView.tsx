import React, { useState } from 'react';
import { Itinerary, Place, DayPlan } from '../types';
import ItineraryMap from './ItineraryMap';
import { exportItineraryToPDF } from '../utils/pdfExport';

export type ModificationType = 'SWAP' | 'REGEN_DAY' | 'REOPTIMIZE';

interface ItineraryViewProps {
  itineraries: Itinerary[];
  onConfirm: () => void;
  isConfirmed: boolean;
  onModify: (type: ModificationType, payload: any) => void;
  isModifying?: boolean;
}

// Helper to get a random image if the API doesn't provide one (for aesthetics)
const getPlaceholderImage = (keyword: string, index: number) => {
  return `https://picsum.photos/400/300?random=${index}`;
};

const ItineraryView: React.FC<ItineraryViewProps> = ({ itineraries, onConfirm, isConfirmed, onModify, isModifying }) => {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [showReasoning, setShowReasoning] = useState(false);
  const [hoveredPlace, setHoveredPlace] = useState<string | null>(null);
  
  const selectedItinerary = itineraries[selectedIdx];

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedItinerary, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `trip_${selectedItinerary.id}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadPDF = () => {
    try {
      exportItineraryToPDF(selectedItinerary);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  const handleSwap = (placeName: string, day: number, timeOfDay: string) => {
    if (isModifying) return;
    onModify('SWAP', { 
        itineraryId: selectedItinerary.id,
        placeName,
        day,
        timeOfDay 
    });
  };

  const handleRegenDay = (day: number) => {
    if (isModifying) return;
    onModify('REGEN_DAY', {
        itineraryId: selectedItinerary.id,
        day
    });
  };

  const handlePaceChange = (pace: string) => {
     if (isModifying) return;
     onModify('REOPTIMIZE', { pace });
  };

  return (
    <div className={`flex flex-col h-full animate-fade-in relative ${isModifying ? 'opacity-50 pointer-events-none' : ''}`}>
      
      {/* Loading Overlay for Modifications */}
      {isModifying && (
        <div className="absolute inset-0 z-50 flex items-center justify-center">
            <div className="bg-white px-6 py-4 rounded-full shadow-xl border border-blue-100 flex items-center gap-3 animate-bounce">
                <i className="fa-solid fa-wand-magic-sparkles text-blue-600"></i>
                <span className="font-semibold text-gray-700">Updating plan...</span>
            </div>
        </div>
      )}

      {/* Tweak Controls */}
      <div className="flex flex-wrap items-center gap-2 mb-4 bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
        <span className="text-xs font-bold text-gray-600 uppercase mr-2 flex items-center gap-2">
          <i className="fa-solid fa-sliders text-blue-600"></i>
          Quick Tweaks:
        </span>
        <button
            onClick={() => handlePaceChange('Relaxed')}
            className="px-4 py-2 bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-sm font-semibold text-gray-700 hover:text-blue-700 transition-all shadow-sm hover:shadow-md"
        >
            <i className="fa-solid fa-mug-hot mr-2 text-orange-500"></i> More Relaxed
        </button>
        <button
            onClick={() => handlePaceChange('Active')}
            className="px-4 py-2 bg-white border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 rounded-lg text-sm font-semibold text-gray-700 hover:text-blue-700 transition-all shadow-sm hover:shadow-md"
        >
            <i className="fa-solid fa-person-running mr-2 text-blue-500"></i> More Active
        </button>
        <button
            onClick={() => handlePaceChange('Budget')}
            className="px-4 py-2 bg-white border-2 border-gray-300 hover:border-green-500 hover:bg-green-50 rounded-lg text-sm font-semibold text-gray-700 hover:text-green-700 transition-all shadow-sm hover:shadow-md"
        >
            <i className="fa-solid fa-piggy-bank mr-2 text-green-500"></i> Cheaper
        </button>
      </div>

      {/* Variant Tabs */}
      <div className="flex gap-3 mb-6 overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
        {itineraries.map((itinerary, idx) => (
          <button
            key={itinerary.id}
            onClick={() => setSelectedIdx(idx)}
            className={`
              flex-shrink-0 px-6 py-4 rounded-xl border-2 text-left min-w-[220px] transition-all duration-200
              ${selectedIdx === idx
                ? 'bg-gradient-to-br from-blue-600 to-indigo-600 text-white border-blue-600 shadow-lg transform scale-[1.03]'
                : 'bg-white text-gray-700 border-gray-300 hover:border-blue-400 hover:bg-blue-50 hover:shadow-md'}
            `}
          >
            <div className="flex items-center gap-2 mb-2">
              <i className={`fa-solid fa-star ${selectedIdx === idx ? 'text-yellow-300' : 'text-gray-400'}`}></i>
              <div className="font-bold text-base">{itinerary.title}</div>
            </div>
            <div className="text-xs opacity-90 truncate mb-2">{itinerary.tags.join(' • ')}</div>
            <div className="mt-2 text-sm font-mono font-bold">
              <span>{itinerary.currency}</span> {itinerary.totalEstimatedCost.toLocaleString()}
            </div>
          </button>
        ))}
      </div>

      {/* Main Content Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden flex flex-col md:flex-row min-h-[500px]">
        
        {/* Left: Day List */}
        <div className="md:w-1/2 p-6 overflow-y-auto max-h-[700px]">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-800">{selectedItinerary.title}</h2>
              <p className="text-gray-500 text-sm mt-1">{selectedItinerary.description}</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={downloadPDF}
                className="px-4 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 transition-all shadow-md hover:shadow-lg font-bold text-sm flex items-center gap-2 border-2 border-red-400"
                title="Export as PDF Report"
              >
                <i className="fa-solid fa-file-pdf"></i>
                <span className="hidden sm:inline">PDF Report</span>
              </button>
              <button
                onClick={downloadJSON}
                className="px-4 py-2 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg font-semibold text-sm flex items-center gap-2"
                title="Download JSON Data"
              >
                <i className="fa-solid fa-code"></i>
                <span className="hidden sm:inline">JSON</span>
              </button>
            </div>
          </div>

          {/* Reasoning Section Toggle */}
          {selectedItinerary.reasoning && (
            <div className="mb-6">
              <button
                onClick={() => setShowReasoning(!showReasoning)}
                className="w-full flex items-center justify-between px-5 py-3 bg-gradient-to-r from-indigo-50 to-purple-50 text-indigo-700 rounded-xl text-sm font-semibold hover:from-indigo-100 hover:to-purple-100 transition-all border-2 border-indigo-200 shadow-sm hover:shadow-md"
              >
                <span className="flex items-center gap-2">
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  Why this plan?
                </span>
                <i className={`fa-solid fa-chevron-down transition-transform duration-200 ${showReasoning ? 'rotate-180' : ''}`}></i>
              </button>
              
              {showReasoning && (
                <div className="mt-2 p-4 bg-white border border-indigo-100 rounded-lg shadow-inner text-sm space-y-4 animate-fade-in">
                  {/* Vibe Mapping */}
                  {selectedItinerary.reasoning.vibeAnalysis.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Vibe Check</h4>
                      <div className="space-y-2">
                        {selectedItinerary.reasoning.vibeAnalysis.map((item, i) => (
                          <div key={i} className="flex flex-col">
                            <span className="font-medium text-indigo-600">{item.vibe}</span>
                            <span className="text-gray-500 text-xs">Influenced: {item.matchedActivities.join(', ')}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Constraints */}
                  {selectedItinerary.reasoning.constraintLog.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Constraints Applied</h4>
                      <ul className="list-disc list-inside text-gray-600">
                        {selectedItinerary.reasoning.constraintLog.map((log, i) => (
                          <li key={i}>{log}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Assumptions */}
                  {selectedItinerary.reasoning.selectedAssumptions.length > 0 && (
                    <div>
                      <h4 className="font-semibold text-gray-700 mb-2 text-xs uppercase tracking-wide">Planning Assumptions</h4>
                      <ul className="list-disc list-inside text-gray-500 italic">
                        {selectedItinerary.reasoning.selectedAssumptions.map((asm, i) => (
                          <li key={i}>{asm}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-8">
            {selectedItinerary.days.map((day, dayIdx) => (
              <div key={dayIdx} className="relative pl-6 border-l-2 border-gray-100 group/day">
                {/* Day Marker */}
                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-blue-100 border-2 border-blue-500"></div>
                
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-bold text-gray-800">Day {day.day}: {day.title}</h3>
                    <button 
                        onClick={() => handleRegenDay(day.day)}
                        className="opacity-0 group-hover/day:opacity-100 text-xs text-blue-600 hover:text-blue-800 bg-blue-50 px-2 py-1 rounded transition-all"
                    >
                        <i className="fa-solid fa-arrows-rotate mr-1"></i> Regenerate Day
                    </button>
                </div>
                
                <div className="space-y-4">
                  {[...day.morning, ...day.afternoon, ...day.evening].map((place, placeIdx) => {
                    const timeOfDay = placeIdx < day.morning.length ? 'Morning' : (placeIdx < day.morning.length + day.afternoon.length ? 'Afternoon' : 'Evening');
                    const uniqueKey = `${day.day}-${place.name}-${placeIdx}`;
                    
                    return (
                    <div
                        key={uniqueKey}
                        className="relative bg-white p-4 rounded-xl border-2 border-gray-200 hover:border-blue-300 hover:shadow-lg transition-all flex gap-4 group/card"
                        onMouseEnter={() => setHoveredPlace(uniqueKey)}
                        onMouseLeave={() => setHoveredPlace(null)}
                    >
                      {/* Swap Button - Always Visible */}
                      <div className="absolute top-3 right-3 z-10">
                          <button
                            onClick={() => handleSwap(place.name, day.day, timeOfDay)}
                            className={`
                              bg-gradient-to-r from-blue-500 to-indigo-500 text-white
                              px-3 py-2 rounded-lg shadow-md hover:shadow-xl
                              flex items-center gap-2 font-semibold text-xs
                              transition-all transform hover:scale-105
                              ${hoveredPlace === uniqueKey ? 'opacity-100' : 'opacity-60 hover:opacity-100'}
                            `}
                            title="Swap Activity"
                          >
                              <i className="fa-solid fa-shuffle"></i>
                              <span className="hidden sm:inline">Swap</span>
                          </button>
                      </div>

                      <img
                        src={place.imageUrl || getPlaceholderImage(place.type, dayIdx * 10 + placeIdx)}
                        alt={place.name}
                        className="w-24 h-24 object-cover rounded-lg flex-shrink-0 bg-gray-200 border-2 border-gray-100"
                      />
                      <div className="flex-1 min-w-0 pr-20">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="font-bold text-gray-900 text-base">{place.name}</h4>
                          <span className="text-sm font-bold bg-gradient-to-r from-green-50 to-emerald-50 px-3 py-1 rounded-lg border-2 border-green-200 text-green-700 whitespace-nowrap ml-2">
                            {place.estimatedCost}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{place.description}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider
                            ${place.type === 'Activity' ? 'bg-orange-100 text-orange-700' : 
                              place.type === 'Food' ? 'bg-green-100 text-green-700' : 
                              place.type === 'Hotel' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-700'}
                          `}>
                            {place.type}
                          </span>
                          {/* Currency Label if different from main itinerary */}
                          {place.currencyCode && place.currencyCode !== selectedItinerary.currency && (
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 uppercase tracking-wider">
                                {place.currencyCode}
                              </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Map Visualizer */}
        <div className="md:w-1/2 bg-gray-50 border-l border-gray-200 flex flex-col p-0 overflow-hidden">
           <div className="flex-1 relative">
               <ItineraryMap days={selectedItinerary.days} />
               
               <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm p-3 rounded-lg shadow-lg border border-gray-200 text-xs z-10">
                  <div className="flex items-center gap-2 font-bold text-gray-800 mb-1">
                      <i className="fa-solid fa-route text-blue-600"></i>
                      {selectedItinerary.days.length} Day Route
                  </div>
                  <p className="text-gray-500">Interactive markers & route</p>
               </div>
           </div>

          <div className="p-6 bg-white border-t border-gray-200">
            <h4 className="font-semibold text-gray-700 mb-3">Booking Summary</h4>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-3">
                <i className="fa-solid fa-circle-info text-yellow-600 mt-1"></i>
                <div className="text-xs text-yellow-800">
                  <span className="font-semibold">Note:</span> Prices are estimates in <span className="font-bold">{selectedItinerary.currency}</span>. Availability confirmed at booking.
                </div>
              </div>
            </div>

            {isConfirmed ? (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-300 rounded-xl p-6 text-center shadow-lg">
                 <i className="fa-solid fa-check-circle text-green-600 text-4xl mb-3 animate-bounce"></i>
                 <h3 className="font-bold text-green-800 text-lg">Trip Confirmed!</h3>
                 <p className="text-sm text-green-700 mt-2">Check your email for booking details and tickets.</p>
              </div>
            ) : (
              <button
                onClick={onConfirm}
                className="w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-lg transition-all transform hover:scale-[1.02] shadow-xl hover:shadow-2xl flex items-center justify-center gap-3 border-2 border-blue-500"
              >
                <i className="fa-solid fa-check-circle text-xl"></i>
                Confirm & Book Trip
                <i className="fa-solid fa-arrow-right"></i>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ItineraryView;