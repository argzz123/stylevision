
import React, { useState, useRef, useEffect } from 'react';
import { StyleRecommendation, Store } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface SwipeableStyleCardProps {
  style: StyleRecommendation;
  onSwipe: (direction: 'left' | 'right') => void;
  onApply: () => void;
  isGenerating: boolean;
  hasResult: boolean; // True if image is already generated for this style
}

const SwipeableStyleCard: React.FC<SwipeableStyleCardProps> = ({ 
  style, 
  onSwipe, 
  onApply, 
  isGenerating,
  hasResult
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const rotation = offset.x * 0.05;
  const opacityLike = Math.min(Math.max(offset.x / 100, 0), 1);
  const opacityNope = Math.min(Math.max(-offset.x / 100, 0), 1);

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setStartPos({ x: clientX, y: clientY });
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    const deltaX = clientX - startPos.x;
    const deltaY = clientY - startPos.y;
    setOffset({ x: deltaX, y: deltaY });
  };

  const handleEnd = () => {
    setIsDragging(false);
    
    // Threshold for swipe action
    if (offset.x > 100) {
      triggerHaptic('success');
      onSwipe('right'); // Like
    } else if (offset.x < -100) {
      triggerHaptic('warning');
      onSwipe('left'); // Dislike
    } else {
      // Reset
      setOffset({ x: 0, y: 0 });
    }
  };

  // Mouse Events
  const onMouseDown = (e: React.MouseEvent) => handleStart(e.clientX, e.clientY);
  const onMouseMove = (e: React.MouseEvent) => handleMove(e.clientX, e.clientY);
  
  // Touch Events
  const onTouchStart = (e: React.TouchEvent) => handleStart(e.touches[0].clientX, e.touches[0].clientY);
  const onTouchMove = (e: React.TouchEvent) => handleMove(e.touches[0].clientX, e.touches[0].clientY);

  return (
    <div 
      className="absolute inset-0 flex items-center justify-center pointer-events-none"
      style={{ zIndex: 10 }}
    >
      <div
        ref={cardRef}
        className="w-full relative bg-[#121212] border border-neutral-800 rounded-2xl shadow-2xl p-5 select-none pointer-events-auto cursor-grab active:cursor-grabbing touch-none"
        style={{
          transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotation}deg)`,
          transition: isDragging ? 'none' : 'transform 0.5s cubic-bezier(0.2, 0.8, 0.2, 1)',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={handleEnd}
      >
        {/* SWIPE INDICATORS */}
        <div 
            className="absolute top-8 left-8 border-4 border-green-500 rounded-lg px-4 py-2 transform -rotate-12 z-20 pointer-events-none transition-opacity"
            style={{ opacity: opacityLike }}
        >
            <span className="text-3xl font-bold text-green-500 uppercase tracking-widest">LIKE</span>
        </div>
        
        <div 
            className="absolute top-8 right-8 border-4 border-red-500 rounded-lg px-4 py-2 transform rotate-12 z-20 pointer-events-none transition-opacity"
            style={{ opacity: opacityNope }}
        >
            <span className="text-3xl font-bold text-red-500 uppercase tracking-widest">NOPE</span>
        </div>

        {/* CONTENT */}
        <div className="flex flex-col h-full">
            <div className="mb-4">
                <h3 className="text-2xl font-serif text-white mb-2">{style.title}</h3>
                <p className="text-sm text-neutral-400 line-clamp-3 leading-relaxed">
                    {style.description}
                </p>
            </div>

            <div className="flex gap-2 mb-6">
                {style.colorPalette?.map((color, idx) => (
                <div 
                    key={idx} 
                    className="w-8 h-8 rounded-full shadow-lg ring-1 ring-white/10"
                    style={{ backgroundColor: color }}
                />
                ))}
            </div>

            <div className="mt-auto space-y-3">
                {/* Apply Button */}
                <button
                    onClick={(e) => {
                        e.stopPropagation(); // Prevent drag start
                        if (!isGenerating) onApply();
                    }}
                    disabled={isGenerating}
                    className={`
                        w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all active:scale-[0.98]
                        ${hasResult 
                            ? 'bg-green-600 text-white hover:bg-green-500' 
                            : isGenerating 
                                ? 'bg-neutral-800 text-neutral-500 cursor-wait' 
                                : 'bg-amber-600 text-black hover:bg-amber-500'
                        }
                    `}
                    // Use onMouseDown/TouchStart stopPropagation to prevent card drag when clicking button
                    onMouseDown={e => e.stopPropagation()}
                    onTouchStart={e => e.stopPropagation()}
                >
                    {isGenerating ? (
                        <>
                            <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            <span>Создаем образ...</span>
                        </>
                    ) : hasResult ? (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                            <span>Образ Готов</span>
                        </>
                    ) : (
                        <>
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
                            <span>Примерить</span>
                        </>
                    )}
                </button>

                {!hasResult && (
                    <p className="text-center text-[10px] text-neutral-500 pb-1">
                        Свайп влево — пропустить, Вправо — сохранить
                    </p>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};

export default SwipeableStyleCard;
