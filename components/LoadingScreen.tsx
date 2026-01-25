
import React from 'react';

interface LoadingScreenProps {
  progress: number;
  error?: string | null;
  onRetry?: () => void;
  message?: string; // New prop for custom status text
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, error, onRetry, message }) => {
  return (
    <div className="fixed inset-0 z-[999] bg-[#050505] flex flex-col items-center justify-center p-6 overflow-hidden">
      
      {/* Background Ambience */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        
        {/* Logo Animation */}
        <div className="mb-10 relative">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-neutral-800 to-black border border-neutral-800 flex items-center justify-center relative shadow-2xl shadow-amber-900/20">
             <span className="font-serif text-5xl text-amber-500 italic animate-pulse">S</span>
          </div>
          {/* Spinning ring */}
          {!error && (
            <div className="absolute inset-0 -m-1 rounded-full border-2 border-amber-500/20 border-t-amber-500 animate-spin"></div>
          )}
        </div>

        {/* Text Content */}
        <h1 className="text-2xl font-serif text-white tracking-widest mb-2">
          STYLE<span className="font-sans font-light text-neutral-500 text-sm ml-1">VISION</span>
        </h1>

        {error ? (
          <div className="text-center animate-fade-in mt-4">
            <p className="text-red-400 text-sm mb-6 bg-red-900/10 border border-red-900/30 p-4 rounded-lg">
              {error}
            </p>
            <button 
              onClick={onRetry}
              className="px-6 py-3 bg-white text-black font-bold rounded-full hover:bg-neutral-200 transition-colors uppercase tracking-wider text-xs shadow-lg"
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="w-full mt-8 animate-fade-in">
             <div className="flex justify-between text-[10px] text-neutral-500 uppercase tracking-widest mb-2 font-bold">
                <span>Загрузка</span>
                <span>{Math.round(progress)}%</span>
             </div>
             
             {/* Progress Bar Container */}
             <div className="h-1 w-full bg-neutral-900 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-amber-700 to-amber-500 transition-all duration-300 ease-out"
                  style={{ width: `${progress}%` }}
                ></div>
             </div>
             
             <p className="text-center text-neutral-600 text-[10px] mt-4 font-light transition-all duration-300">
                {message || "Настраиваем AI стилиста..."}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
