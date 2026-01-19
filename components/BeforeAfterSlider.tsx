
import React, { useState, useRef, useEffect } from 'react';

interface BeforeAfterSliderProps {
  beforeImage: string;
  afterImage: string;
}

const BeforeAfterSlider: React.FC<BeforeAfterSliderProps> = ({ beforeImage, afterImage }) => {
  const [sliderPosition, setSliderPosition] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isResizing, setIsResizing] = useState(false);

  // Determine if we should show the slider functionality
  const isComparison = beforeImage && afterImage && beforeImage !== afterImage;

  const handleMouseDown = () => isComparison && setIsResizing(true);
  const handleMouseUp = () => setIsResizing(false);
  
  const handleMouseMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isResizing || !containerRef.current || !isComparison) return;
    
    const rect = containerRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const position = ((x - rect.left) / rect.width) * 100;
    
    setSliderPosition(Math.min(Math.max(position, 0), 100));
  };

  useEffect(() => {
     window.addEventListener('mouseup', handleMouseUp);
     window.addEventListener('touchend', handleMouseUp);
     return () => {
        window.removeEventListener('mouseup', handleMouseUp);
        window.removeEventListener('touchend', handleMouseUp);
     }
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`relative w-full h-full select-none rounded-lg overflow-hidden ${isComparison ? 'cursor-ew-resize' : ''}`}
      onMouseMove={handleMouseMove}
      onTouchMove={handleMouseMove}
      onMouseDown={handleMouseDown}
      onTouchStart={handleMouseDown}
    >
      {/* After Image (Background) - Always Visible as base */}
      <img 
        src={afterImage} 
        alt="After" 
        className="absolute inset-0 w-full h-full object-cover"
        draggable={false}
      />
      
      {isComparison && (
        <>
          {/* Label After */}
          <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-md px-2 py-1 text-[10px] uppercase tracking-widest text-amber-500 font-bold z-10 pointer-events-none transition-opacity duration-300">
             AI Style
          </div>

          {/* Before Image (Clipped) */}
          <div 
            className="absolute inset-0 overflow-hidden border-r-2 border-amber-500 bg-black"
            style={{ width: `${sliderPosition}%` }}
          >
            <img 
              src={beforeImage} 
              alt="Before" 
              className="absolute inset-0 w-full h-full object-cover max-w-none"
              style={{ width: containerRef.current?.offsetWidth || '100%' }}
              draggable={false}
            />
            {/* Label Before */}
             <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md px-2 py-1 text-[10px] uppercase tracking-widest text-white font-bold pointer-events-none">
                Original
             </div>
          </div>

          {/* Slider Handle */}
          <div 
            className="absolute inset-y-0 w-8 -ml-4 flex items-center justify-center pointer-events-none z-20"
            style={{ left: `${sliderPosition}%` }}
          >
            <div className="w-8 h-8 rounded-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)] flex items-center justify-center">
                <svg className="w-4 h-4 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" transform="rotate(90 12 12)" />
                </svg>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default BeforeAfterSlider;
