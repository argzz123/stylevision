import React, { useState, useRef, useEffect } from 'react';

interface ImageEditorProps {
  originalImage: string; // The base image to display
  onEdit: (prompt: string, mask?: string) => void;
  isProcessing: boolean;
}

const ImageEditor: React.FC<ImageEditorProps> = ({ originalImage, onEdit, isProcessing }) => {
  const [prompt, setPrompt] = useState('');
  const [isMaskingMode, setIsMaskingMode] = useState(false);
  const [brushSize, setBrushSize] = useState(20);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasMask, setHasMask] = useState(false);

  // Setup Canvas sizing
  useEffect(() => {
    if (!isMaskingMode || !containerRef.current || !canvasRef.current) return;

    const img = new Image();
    img.src = originalImage;
    img.onload = () => {
       if (canvasRef.current && containerRef.current) {
          // Match canvas size to the displayed image size
          const rect = containerRef.current.getBoundingClientRect();
          canvasRef.current.width = rect.width;
          canvasRef.current.height = rect.height;
          
          // Clear canvas initially
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
       }
    };
  }, [isMaskingMode, originalImage]);

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isMaskingMode) return;
    setIsDrawing(true);
    draw(e);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    if (canvasRef.current) {
       // Check if canvas is not empty
       setHasMask(true);
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY) - rect.top;

    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = 'rgba(217, 119, 6, 0.6)'; // Semi-transparent amber
    ctx.fillStyle = 'rgba(217, 119, 6, 0.6)';

    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const clearMask = () => {
     if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        setHasMask(false);
     }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isProcessing) return;

    let maskData: string | undefined = undefined;

    if (isMaskingMode && hasMask && canvasRef.current) {
       // Convert drawing to a binary-ish mask (white on black) or just send as is depending on backend strategy
       // For Gemini multi-modal, we usually want the mask clearly distinct. 
       // We'll send the drawn canvas as a PNG.
       maskData = canvasRef.current.toDataURL('image/png');
    }

    onEdit(prompt, maskData);
    setPrompt('');
    // Don't clear mask immediately, user might want to edit again
  };

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 flex flex-col h-full relative">
       
       {/* Masking Overlay (Only visible in Mask Mode) */}
       {isMaskingMode && (
          <div 
             ref={containerRef}
             className="absolute -top-[100%] left-0 w-full h-full z-20 cursor-crosshair touch-none"
             style={{ top: `-${containerRef.current?.clientHeight || 0}px` }} // Moves overlay to cover the image above
          >
             {/* This div is just a placeholder logic; in App.tsx we position Editor below Image. 
                 To make masking work over the image, we ideally need the canvas ON TOP of the image in the parent component.
                 However, to keep components clean, we'll assume this editor sits BELOW the image, 
                 but for masking we need to overlay. 
                 
                 BETTER UX: Let's toggle the Mode in this component, but the Canvas actually needs to render OVER the image in the App.
                 
                 Since we can't easily portal without complex ref passing, we will implement a "Mini Edit Mode" inside App.tsx or
                 use a localized UI here. 
                 
                 Let's simplify: In Mask Mode, we show a "Drawing Area" placeholder? No, that's bad UX.
                 
                 Revised approach: This component is just the controls. The Canvas lives in App.tsx or inside the Image Container.
                 
                 Actually, let's keep it simple: The `ImageEditor` controls the inputs. 
                 The Masking Canvas should be overlayed on the image in `App.tsx`. 
                 But wait, I only have access to change `ImageEditor` and `App`.
                 
                 I will refactor `App.tsx` to handle the canvas layer, and use this component for the input controls.
             */}
          </div>
       )}

      {/* Editor Controls */}
      <div className="p-4 space-y-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
              <button 
                 type="button"
                 onClick={() => setIsMaskingMode(!isMaskingMode)}
                 className={`
                    px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-all flex items-center gap-2
                    ${isMaskingMode 
                       ? 'bg-amber-600 text-black border-amber-600' 
                       : 'bg-transparent text-neutral-400 border-neutral-700 hover:border-white'}
                 `}
              >
                 <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                 </svg>
                 {isMaskingMode ? 'Рисование' : 'Маска'}
              </button>
              
              {isMaskingMode && (
                 <>
                    <button onClick={clearMask} className="text-xs text-neutral-500 hover:text-white underline decoration-dotted">
                       Очистить
                    </button>
                    <input 
                       type="range" 
                       min="5" max="50" 
                       value={brushSize} 
                       onChange={(e) => setBrushSize(Number(e.target.value))}
                       className="w-20 accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                    />
                 </>
              )}
           </div>
           
           <span className="text-[10px] text-neutral-600 uppercase">
              {isMaskingMode ? 'Закрасьте область для замены' : 'Глобальное изменение'}
           </span>
        </div>

        <form onSubmit={handleSubmit} className="relative">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={isMaskingMode ? "Что добавить в выделенную область?" : "Опишите изменения всего образа..."}
            className="w-full bg-black border border-neutral-700 rounded-lg py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-amber-500 transition-all"
            disabled={isProcessing}
          />
          <button
            type="submit"
            disabled={!prompt.trim() || isProcessing}
            className="absolute right-2 top-2 bottom-2 bg-neutral-800 hover:bg-neutral-700 text-white w-8 rounded flex items-center justify-center transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ImageEditor;