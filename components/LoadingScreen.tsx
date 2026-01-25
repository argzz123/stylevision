
import React from 'react';

interface LoadingScreenProps {
  progress: number;
  error?: string | null;
  onRetry?: () => void;
  message?: string; 
  theme?: 'light' | 'dark'; // Added theme prop
}

const LoadingScreen: React.FC<LoadingScreenProps> = ({ progress, error, onRetry, message, theme = 'dark' }) => {
  return (
    <div className={`fixed inset-0 z-[999] flex flex-col items-center justify-center p-6 overflow-hidden transition-colors duration-300 ${theme === 'dark' ? 'bg-[#050505]' : 'bg-white'}`}>
      
      {/* Background Ambience */}
      <div className={`absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${theme === 'dark' ? 'bg-amber-900/10' : 'bg-tangerine-100/60'}`}></div>
      <div className={`absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full blur-[120px] pointer-events-none transition-colors duration-500 ${theme === 'dark' ? 'bg-blue-900/10' : 'bg-blue-50/50'}`}></div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-sm">
        
        {/* Logo Animation */}
        <div className="mb-10 relative">
          <div className={`w-24 h-24 rounded-full bg-gradient-to-br flex items-center justify-center relative shadow-2xl ${theme === 'dark' ? 'from-neutral-800 to-black border-neutral-800 shadow-amber-900/20' : 'from-white to-gray-50 border-gray-200 shadow-tangerine-200/20'} border`}>
             <span className={`font-serif text-5xl italic animate-pulse ${theme === 'dark' ? 'text-amber-500' : 'text-tangerine-500'}`}>S</span>
          </div>
          {/* Spinning ring */}
          {!error && (
            <div className={`absolute inset-0 -m-1 rounded-full border-2 border-t-transparent animate-spin ${theme === 'dark' ? 'border-amber-500/20 border-t-amber-500' : 'border-tangerine-500/20 border-t-tangerine-500'}`}></div>
          )}
        </div>

        {/* Text Content */}
        <h1 className={`text-2xl font-serif tracking-widest mb-2 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
          STYLE<span className={`font-sans font-light text-sm ml-1 ${theme === 'dark' ? 'text-neutral-500' : 'text-gray-400'}`}>VISION</span>
        </h1>

        {error ? (
          <div className="text-center animate-fade-in mt-4">
            <p className={`text-sm mb-6 p-4 rounded-lg border ${theme === 'dark' ? 'text-red-400 bg-red-900/10 border-red-900/30' : 'text-red-600 bg-red-50 border-red-200'}`}>
              {error}
            </p>
            <button 
              onClick={onRetry}
              className={`px-6 py-3 font-bold rounded-full transition-colors uppercase tracking-wider text-xs shadow-lg ${theme === 'dark' ? 'bg-white text-black hover:bg-neutral-200' : 'bg-black text-white hover:bg-gray-800'}`}
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <div className="w-full mt-8 animate-fade-in">
             <div className={`flex justify-between text-[10px] uppercase tracking-widest mb-2 font-bold ${theme === 'dark' ? 'text-neutral-500' : 'text-gray-500'}`}>
                <span>Загрузка</span>
                <span>{Math.round(progress)}%</span>
             </div>
             
             {/* Progress Bar Container */}
             <div className={`h-1 w-full rounded-full overflow-hidden ${theme === 'dark' ? 'bg-neutral-900' : 'bg-gray-100'}`}>
                <div 
                  className={`h-full bg-gradient-to-r transition-all duration-300 ease-out ${theme === 'dark' ? 'from-amber-700 to-amber-500' : 'from-tangerine-400 to-tangerine-600'}`}
                  style={{ width: `${progress}%` }}
                ></div>
             </div>
             
             <p className={`text-center text-[10px] mt-4 font-medium transition-all duration-300 ${theme === 'dark' ? 'text-neutral-600' : 'text-gray-500'}`}>
                {message || "Настраиваем AI стилиста..."}
             </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoadingScreen;
