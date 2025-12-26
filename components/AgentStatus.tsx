import React from 'react';
import { AgentStatus } from '../types';

interface AgentStatusProps {
  status: AgentStatus;
}

const AgentStatusVisualizer: React.FC<AgentStatusProps> = ({ status }) => {
  if (status === AgentStatus.IDLE || status === AgentStatus.COMPLETE || status === AgentStatus.ERROR) {
    return null;
  }

  const steps = [
    { id: AgentStatus.PARSING_INTENT, label: "Intent Agent", icon: "fa-brain" },
    { id: AgentStatus.DISCOVERY, label: "Discovery Agent", icon: "fa-map-location-dot" },
    { id: AgentStatus.OPTIMIZING, label: "Optimization Agent", icon: "fa-clock" },
    { id: AgentStatus.RENDERING, label: "Rendering Itinerary", icon: "fa-pen-ruler" },
  ];

  const getCurrentStepIndex = () => {
    if (status === AgentStatus.PARSING_INTENT || status === AgentStatus.REVIEW_INTENT) return 0;
    if (status === AgentStatus.DISCOVERY || status === AgentStatus.REVIEW_DISCOVERY) return 1;
    if (status === AgentStatus.OPTIMIZING) return 2;
    if (status === AgentStatus.RENDERING) return 3;
    return -1;
  };

  const isReviewing = status === AgentStatus.REVIEW_INTENT || status === AgentStatus.REVIEW_DISCOVERY;
  const currentIndex = getCurrentStepIndex();

  return (
    <div className="w-full bg-white border border-gray-100 rounded-xl shadow-sm p-6 mb-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
        <i className="fa-solid fa-server mr-2"></i> Cloud Workflow Orchestration
      </h3>
      <div className="relative flex items-center justify-between w-full">
        {/* Progress Bar Background */}
        <div className="absolute top-1/2 left-0 w-full h-1 bg-gray-200 -z-10 rounded-full"></div>
        
        {/* Progress Bar Fill */}
        <div 
          className="absolute top-1/2 left-0 h-1 bg-blue-600 -z-10 rounded-full transition-all duration-500"
          style={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
        ></div>

        {steps.map((step, idx) => {
          const isActive = idx === currentIndex;
          const isCompleted = idx < currentIndex;
          
          return (
            <div key={step.id} className="flex flex-col items-center group">
              <div 
                className={`
                  w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300
                  ${isActive && isReviewing ? 'bg-orange-500 border-orange-500 text-white scale-110' : ''}
                  ${isActive && !isReviewing ? 'bg-blue-600 border-blue-600 text-white scale-110 shadow-lg' : ''}
                  ${isCompleted ? 'bg-green-500 border-green-500 text-white' : ''}
                  ${!isActive && !isCompleted ? 'bg-white border-gray-300 text-gray-300' : ''}
                `}
              >
                <i className={`fa-solid ${step.icon}`}></i>
              </div>
              <span className={`
                mt-2 text-xs font-medium transition-colors duration-300
                ${isActive && isReviewing ? 'text-orange-500' : ''}
                ${isActive && !isReviewing ? 'text-blue-600' : ''}
                ${!isActive ? 'text-gray-400' : ''}
              `}>
                {step.label}
              </span>
              {isActive && isReviewing && (
                <span className="mt-1 text-[10px] text-orange-500 animate-pulse font-bold">Review Needed</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgentStatusVisualizer;