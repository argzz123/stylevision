import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '../types';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string) => void;
  isProcessing: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ messages, onSendMessage, isProcessing }) => {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isProcessing) {
      onSendMessage(input);
      setInput('');
    }
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 flex flex-col h-[500px]">
      {/* Chat Header */}
      <div className="p-4 border-b border-neutral-800 bg-neutral-900 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
             <div className="w-8 h-8 rounded-full bg-amber-900/30 border border-amber-600/50 flex items-center justify-center">
                <span className="font-serif text-amber-500 italic">S</span>
             </div>
             <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-neutral-900"></div>
          </div>
          <div>
             <h3 className="text-sm font-medium text-white">AI Стилист</h3>
             <p className="text-[10px] text-neutral-500">Online • Отвечает мгновенно</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div ref={scrollRef} className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar bg-[#080808]">
        {messages.length === 0 && (
          <div className="text-center mt-8">
            <p className="text-xs text-neutral-600 mb-2">Начните диалог с вашим стилистом</p>
            <div className="flex flex-wrap justify-center gap-2">
               {['Что изменить?', 'Сделай образ ярче', 'Замени обувь', 'Добавь аксессуары'].map(t => (
                  <button 
                     key={t}
                     onClick={() => onSendMessage(t)}
                     className="text-[10px] px-3 py-1 bg-neutral-800 text-neutral-400 hover:text-white rounded-full transition-colors border border-neutral-700"
                  >
                     {t}
                  </button>
               ))}
            </div>
          </div>
        )}
        
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div 
              className={`
                max-w-[85%] p-3 text-sm leading-relaxed
                ${msg.role === 'user' 
                  ? 'bg-amber-600 text-white rounded-t-lg rounded-bl-lg' 
                  : 'bg-neutral-800 text-neutral-200 rounded-t-lg rounded-br-lg'}
              `}
            >
              {msg.text}
            </div>
          </div>
        ))}
        
        {isProcessing && (
          <div className="flex justify-start">
             <div className="bg-neutral-800 p-3 rounded-t-lg rounded-br-lg flex gap-1 items-center h-10">
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce"></span>
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-1.5 h-1.5 bg-neutral-500 rounded-full animate-bounce delay-200"></span>
             </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <form onSubmit={handleSubmit} className="p-3 bg-neutral-900 border-t border-neutral-800 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Напишите сообщение..."
          disabled={isProcessing}
          className="flex-grow bg-black border border-neutral-700 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors placeholder-neutral-600"
        />
        <button 
          type="submit"
          disabled={!input.trim() || isProcessing}
          className="w-10 h-10 rounded-full bg-amber-600 text-black flex items-center justify-center hover:bg-amber-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
        >
          <svg className="w-5 h-5 transform rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;