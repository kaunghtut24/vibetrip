import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, AgentStatus } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (msg: string) => void;
  status: AgentStatus;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, status }) => {
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || status !== AgentStatus.IDLE) return;
    onSendMessage(input);
    setInput('');
  };

  const isProcessing = status !== AgentStatus.IDLE && status !== AgentStatus.COMPLETE && status !== AgentStatus.ERROR;

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] min-h-[500px] max-h-[800px] bg-white rounded-2xl shadow-lg border-2 border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b-2 border-gray-200 bg-gradient-to-r from-indigo-50 to-blue-50 flex justify-between items-center">
        <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 flex items-center justify-center text-white shadow-md">
                <i className="fa-solid fa-robot text-lg"></i>
            </div>
            <div>
                <h3 className="font-bold text-gray-800">VibeTrip Agent</h3>
                <p className="text-xs text-gray-600 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                  Powered by Gemini 2.5
                </p>
            </div>
        </div>
        <button className="text-xs text-gray-500 hover:text-gray-700 hover:bg-white px-3 py-2 rounded-lg transition-all font-semibold">
            <i className="fa-solid fa-rotate-right mr-1"></i> Reset
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white">
        {messages.length === 0 && (
           <div className="flex flex-col items-center justify-center h-full text-center text-gray-400 p-8">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <i className="fa-solid fa-paper-plane text-4xl text-blue-600"></i>
              </div>
              <h3 className="text-lg font-bold text-gray-700 mb-2">Where do you want to go?</h3>
              <p className="text-sm text-gray-500 mb-6">Try one of these popular destinations:</p>
              <div className="flex flex-wrap gap-3 justify-center">
                  <button
                    onClick={() => setInput("Weekend in Tokyo for foodies")}
                    className="px-4 py-2 bg-gradient-to-r from-pink-50 to-red-50 hover:from-pink-100 hover:to-red-100 border-2 border-pink-200 hover:border-pink-300 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm hover:shadow-md"
                  >
                    🍜 Tokyo Foodie
                  </button>
                  <button
                    onClick={() => setInput("5 days in Paris, luxury shopping")}
                    className="px-4 py-2 bg-gradient-to-r from-purple-50 to-indigo-50 hover:from-purple-100 hover:to-indigo-100 border-2 border-purple-200 hover:border-purple-300 rounded-xl text-sm font-semibold text-gray-700 transition-all shadow-sm hover:shadow-md"
                  >
                    🛍️ Paris Luxury
                  </button>
              </div>
           </div>
        )}
        
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none border border-gray-200'
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {isProcessing && (
           <div className="flex justify-start">
             <div className="bg-gray-100 rounded-2xl rounded-bl-none px-4 py-3 border border-gray-200">
               <div className="flex gap-1.5">
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-100"></div>
                 <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce delay-200"></div>
               </div>
             </div>
           </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-4 border-t-2 border-gray-200 bg-gradient-to-r from-gray-50 to-blue-50">
        <div className="relative">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isProcessing}
            placeholder={isProcessing ? "Agent is thinking..." : "Describe your dream trip..."}
            className="w-full pl-5 pr-14 py-4 bg-white text-gray-900 placeholder-gray-500 border-2 border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-md transition-all disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed text-sm font-medium"
          />
          <button
            type="submit"
            disabled={!input.trim() || isProcessing}
            className="absolute right-2 top-2 p-2 w-10 h-10 flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:from-blue-700 hover:to-indigo-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg transform hover:scale-105 disabled:transform-none"
          >
            <i className="fa-solid fa-paper-plane text-sm"></i>
          </button>
        </div>
      </form>
    </div>
  );
};

export default ChatInterface;