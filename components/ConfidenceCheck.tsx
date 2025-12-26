import React from 'react';

interface ConfidenceCheckProps {
  score: number;
  assumptions: string[];
  onConfirm: () => void;
  onCancel: () => void;
  agentName: string;
}

const ConfidenceCheck: React.FC<ConfidenceCheckProps> = ({ score, assumptions, onConfirm, onCancel, agentName }) => {
  const isLowConfidence = score < 0.7;

  return (
    <div className="bg-orange-50 border border-orange-200 rounded-xl p-5 my-4 animate-fade-in shadow-sm">
      <div className="flex items-start gap-3">
        <div className={`
          w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
          ${isLowConfidence ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}
        `}>
          <i className={`fa-solid ${isLowConfidence ? 'fa-triangle-exclamation' : 'fa-clipboard-check'}`}></i>
        </div>
        
        <div className="flex-1">
          <h4 className="font-bold text-gray-800">
            {agentName} needs a quick review
          </h4>
          
          <div className="flex items-center gap-2 mt-1 mb-3">
            <span className="text-xs font-medium text-gray-500 uppercase">Confidence Score</span>
            <div className="w-24 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                    className={`h-full ${score > 0.8 ? 'bg-green-500' : score > 0.6 ? 'bg-yellow-500' : 'bg-red-500'}`} 
                    style={{ width: `${score * 100}%` }}
                ></div>
            </div>
            <span className="text-xs font-bold text-gray-700">{Math.round(score * 100)}%</span>
          </div>

          <p className="text-sm text-gray-600 mb-2">I made the following assumptions to proceed:</p>
          <ul className="list-disc list-inside text-sm text-gray-700 space-y-1 mb-4 bg-white p-3 rounded-lg border border-orange-100">
            {assumptions.map((note, idx) => (
              <li key={idx} className="leading-snug">{note}</li>
            ))}
          </ul>

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={onConfirm}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white text-sm font-bold rounded-xl transition-all shadow-lg hover:shadow-xl transform hover:scale-105 flex items-center gap-2"
            >
              <i className="fa-solid fa-check-circle"></i>
              Yes, proceed
              <i className="fa-solid fa-arrow-right"></i>
            </button>
            <button
              onClick={onCancel}
              className="px-6 py-3 bg-white hover:bg-gray-100 border-2 border-gray-400 hover:border-gray-500 text-gray-700 text-sm font-bold rounded-xl transition-all shadow-md hover:shadow-lg flex items-center gap-2"
            >
              <i className="fa-solid fa-xmark"></i>
              No, I'll clarify
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfidenceCheck;