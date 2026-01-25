
import React from 'react';
import { StyleRecommendation, Store } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface StyleCardProps {
  style: StyleRecommendation;
  isSelected: boolean;
  onClick: () => void;
  onApplyStyle: () => void;
  isGenerating: boolean; 
  isProcessingGlobal?: boolean; 
  stores: Store[]; 
}

const StyleCard: React.FC<StyleCardProps> = ({ 
    style, 
    isSelected, 
    onClick, 
    onApplyStyle, 
    isGenerating, 
    isProcessingGlobal, 
    stores 
}) => {
  
  const handleItemClick = (itemName: string) => {
    triggerHaptic('light');
    const activeStores = stores.filter(s => s.isSelected);
    let searchDomain = '';
    
    if (activeStores.length > 0) {
        const randomStore = activeStores[Math.floor(Math.random() * activeStores.length)];
        searchDomain = `site:${randomStore.domain} `;
    }

    const query = `${searchDomain}${itemName} купить`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&tbm=isch`; 
    window.open(url, '_blank');
  };

  const safeTitle = style.title || "Стильный образ";
  const safeDescription = style.description || "Описание образа формируется...";

  return (
    <div 
      onClick={!isProcessingGlobal ? onClick : undefined}
      className={`
        rounded-xl border p-4 md:p-6 relative flex flex-col h-auto
        transform-gpu transition-all duration-300 ease-out
        ${isSelected 
          ? 'bg-white dark:bg-[#121212] border-tangerine-500 dark:border-amber-500/80 shadow-[0_4px_20px_rgba(249,115,22,0.15)] dark:shadow-[0_4px_20px_rgba(245,158,11,0.15)] z-10 scale-[1.01]' 
          : 'bg-white dark:bg-[#0f0f0f]/80 border-gray-200 dark:border-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 hover:bg-gray-50 dark:hover:bg-[#151515] opacity-90 z-0 active:scale-[0.98]'}
        ${isProcessingGlobal && !isSelected ? 'opacity-50 cursor-not-allowed grayscale' : 'cursor-pointer'}
      `}
    >
      <div className="flex justify-between items-start mb-3">
        <h3 className={`text-xl md:text-2xl font-serif tracking-wide transition-colors ${isSelected ? 'text-tangerine-600 dark:text-amber-500' : 'text-gray-900 dark:text-neutral-300'}`}>
          {safeTitle}
        </h3>
      </div>
      
      <p className={`text-gray-700 font-medium dark:text-neutral-400 text-xs md:text-sm mb-4 leading-relaxed transition-all ${isSelected ? '' : 'line-clamp-2'}`}>
        {safeDescription}
      </p>
      
      <div className="flex gap-2 mb-5 overflow-x-auto pb-4 scrollbar-hide">
        {style.colorPalette?.map((color, idx) => (
          <div 
            key={idx} 
            className="w-5 h-5 md:w-6 md:h-6 rounded-full shadow-lg ring-1 ring-black/5 dark:ring-white/10 flex-shrink-0"
            style={{ backgroundColor: color }}
          />
        ))}
      </div>

      <div className="space-y-3 mb-6 border-t border-gray-100 dark:border-neutral-800 pt-4">
        <h4 className="text-[10px] font-bold text-gray-500 dark:text-neutral-500 uppercase tracking-[0.2em] mb-2">Гардероб (Нажмите для поиска)</h4>
        <ul className="space-y-2">
          {style.items?.map((item, idx) => (
            <li key={idx}>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  handleItemClick(item.name);
                }}
                className="w-full text-left flex items-center justify-between p-3 rounded bg-gray-50 dark:bg-neutral-900/50 border border-gray-100 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:border-gray-300 dark:hover:border-neutral-600 transition-all group/item active:bg-gray-200 dark:active:bg-neutral-800"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-8 h-8 rounded-full bg-white dark:bg-neutral-800 border border-gray-200 dark:border-transparent flex items-center justify-center text-lg flex-shrink-0 group-hover/item:bg-gray-200 dark:group-hover/item:bg-neutral-700 transition-colors">
                        👗
                    </div>
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm text-gray-800 dark:text-neutral-200 font-bold truncate group-hover/item:text-tangerine-600 dark:group-hover/item:text-amber-500 transition-colors">
                            {item.name}
                        </span>
                        <span className="text-[10px] text-gray-500 font-medium dark:text-neutral-500">
                             {item.category}
                        </span>
                    </div>
                </div>
                
                <svg className="w-4 h-4 text-gray-400 dark:text-neutral-600 group-hover/item:text-gray-900 dark:group-hover/item:text-white transform group-hover/item:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Button Container with smooth fade/slide */}
      <div className={`overflow-hidden transition-all duration-300 ${isSelected ? 'max-h-20 opacity-100 mt-auto' : 'max-h-0 opacity-0'}`}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            triggerHaptic('medium'); // Stronger feedback for main action
            onApplyStyle();
          }}
          disabled={isProcessingGlobal} 
          className={`
            w-full font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center gap-3 text-sm tracking-wide uppercase shadow-lg mb-1
            ${isProcessingGlobal 
                ? 'bg-gray-200 dark:bg-neutral-800 text-gray-400 dark:text-neutral-500 cursor-not-allowed' 
                : 'bg-tangerine-500 dark:bg-amber-600 hover:bg-tangerine-600 dark:hover:bg-amber-500 text-white dark:text-black shadow-tangerine-500/20 dark:shadow-amber-900/20 active:scale-[0.98]'}
          `}
        >
          {isGenerating ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white dark:text-amber-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span className="text-white dark:text-amber-500">Примерка...</span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
              </svg>
              <span>Примерить</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default StyleCard;
