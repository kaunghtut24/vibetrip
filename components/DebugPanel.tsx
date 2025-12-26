import React, { useState, useEffect } from 'react';
import { agentLogger, AgentLog } from '../services/logger';

const DebugPanel: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<AgentLog[]>([]);

  useEffect(() => {
    const unsubscribe = agentLogger.subscribe(setLogs);
    return unsubscribe;
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-gradient-to-r from-gray-800 to-gray-900 text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center gap-2 group border border-gray-700"
        title="Open Debug Panel"
      >
        <i className="fa-solid fa-bug text-green-400"></i>
        <span className="text-xs font-semibold hidden sm:inline">Debug</span>
        {logs.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center animate-pulse">
            {logs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-[500px] max-w-[calc(100vw-3rem)] bg-white rounded-2xl shadow-2xl border-2 border-gray-300 flex flex-col max-h-[70vh] animate-fade-in font-mono text-xs">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
            <i className="fa-solid fa-terminal text-white text-sm"></i>
          </div>
          <div>
            <span className="font-bold text-sm">Agent Debugger</span>
            <p className="text-[10px] text-gray-400">{logs.length} events logged</p>
          </div>
        </div>
        <div className="flex gap-2">
            <button
              onClick={() => agentLogger.clear()}
              className="hover:bg-red-500 bg-red-600 px-3 py-1.5 rounded-lg transition-colors text-xs font-semibold"
              title="Clear logs"
            >
                <i className="fa-solid fa-trash mr-1"></i> Clear
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="hover:bg-gray-700 bg-gray-600 px-3 py-1.5 rounded-lg transition-colors"
              title="Close panel"
            >
                <i className="fa-solid fa-xmark"></i>
            </button>
        </div>
      </div>

      {/* Logs List */}
      <div className="flex-1 overflow-y-auto p-2 bg-gray-50 space-y-2">
        {logs.length === 0 && (
          <div className="text-center text-gray-400 py-8 italic">
            No agent activity recorded yet.
          </div>
        )}
        {logs.map((log) => (
          <div key={log.id} className="bg-white p-3 rounded border border-gray-200 shadow-sm relative overflow-hidden group">
             {/* Status Indicator Line */}
             <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                 log.status === 'RUNNING' ? 'bg-blue-500 animate-pulse' :
                 log.status === 'SUCCESS' ? 'bg-green-500' : 'bg-red-500'
             }`}></div>

             <div className="pl-3">
               <div className="flex justify-between items-start mb-1">
                 <span className="font-bold text-gray-700">{log.agentName}</span>
                 <div className="flex flex-col items-end">
                    <span className="text-[10px] text-gray-400">{new Date(log.timestamp).toLocaleTimeString()}</span>
                    {log.durationMs && (
                        <span className="text-[10px] font-semibold text-blue-600">{log.durationMs}ms</span>
                    )}
                 </div>
               </div>

               <div className="grid grid-cols-2 gap-2 mb-2">
                 <div className="bg-gray-100 p-1.5 rounded">
                    <div className="text-[10px] text-gray-500 uppercase">Input Hash</div>
                    <div className="font-mono text-gray-700 truncate" title={log.inputPreview}>{log.inputHash}</div>
                 </div>
                 {log.outputHash && (
                    <div className="bg-gray-100 p-1.5 rounded">
                        <div className="text-[10px] text-gray-500 uppercase">Output Hash</div>
                        <div className="font-mono text-gray-700 truncate">{log.outputHash}</div>
                    </div>
                 )}
               </div>

               {log.confidence !== undefined && (
                 <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-gray-500 uppercase">Confidence</span>
                    <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${log.confidence > 0.7 ? 'bg-green-500' : 'bg-orange-500'}`} 
                            style={{ width: `${log.confidence * 100}%` }}
                        ></div>
                    </div>
                    <span className="text-[10px] font-bold">{Math.round(log.confidence * 100)}%</span>
                 </div>
               )}

               {log.error && (
                 <div className="mt-2 p-2 bg-red-50 text-red-600 border border-red-100 rounded break-words">
                    <strong>Error:</strong> {log.error}
                 </div>
               )}
               
               {log.status === 'RUNNING' && (
                 <div className="mt-1 flex items-center gap-2 text-blue-500">
                    <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                    <span className="italic">Processing...</span>
                 </div>
               )}
             </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DebugPanel;