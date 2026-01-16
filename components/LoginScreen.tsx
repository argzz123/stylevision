import React, { useState, useEffect, useRef } from 'react';
import { TelegramUser } from '../types';

interface LoginScreenProps {
  onLogin: (user: TelegramUser) => void;
  isOverlay?: boolean; // If true, renders as a modal on top of existing content
  onCancel?: () => void; // For overlay mode
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isOverlay = false, onCancel }) => {
  const [mockName, setMockName] = useState('');
  const telegramWrapperRef = useRef<HTMLDivElement>(null);

  // 1. SETUP TELEGRAM WIDGET
  useEffect(() => {
    // Define the global callback that Telegram widget will call upon success
    (window as any).onTelegramAuth = (user: any) => {
      console.log("Real Telegram Auth Success:", user);
      onLogin({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url,
        isGuest: false
      });
    };

    // Inject the script
    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', 'stylevision_bot'); // Your Bot Username
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;

    if (telegramWrapperRef.current) {
        telegramWrapperRef.current.innerHTML = ''; // Clear previous instances
        telegramWrapperRef.current.appendChild(script);
    }

    return () => {
        // Cleanup mostly managed by React unmounting the div, but good to know
    };
  }, [onLogin]);

  // 2. GUEST LOGIN (Fallback)
  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockName.trim()) return;

    const guestUser: TelegramUser = {
      id: Date.now(), // Random ID
      first_name: mockName,
      username: `guest_${Date.now()}`,
      isGuest: true // Mark as guest
    };
    onLogin(guestUser);
  };

  const containerClasses = isOverlay 
    ? "fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
    : "min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden";

  return (
    <div className={containerClasses}>
      {/* Background Ambience (Only if not overlay) */}
      {!isOverlay && (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        </div>
      )}

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
         {!isOverlay && (
             <div className="text-center mb-12">
                <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 p-[1px] shadow-2xl shadow-amber-900/30">
                <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                    <span className="font-serif text-4xl text-amber-500 italic">S</span>
                </div>
                </div>
                <h1 className="text-4xl font-serif text-white mb-2 tracking-wide">
                STYLE<span className="font-sans font-light text-neutral-500 text-lg ml-1">VISION</span>
                </h1>
                <p className="text-neutral-500 text-sm tracking-widest uppercase">Персональный ИИ Стилист</p>
             </div>
         )}

         <div className={`bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-8 shadow-2xl ${isOverlay ? 'border-amber-600/30 shadow-amber-900/20' : ''}`}>
            {isOverlay && onCancel && (
                <button onClick={onCancel} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
            )}

            <h2 className="text-xl font-serif text-white mb-2 text-center">
                {isOverlay ? 'Требуется авторизация' : 'Авторизация'}
            </h2>
            {isOverlay && (
                <p className="text-amber-500 text-xs text-center mb-6">
                    Для оформления подписки необходимо привязать Telegram аккаунт.
                </p>
            )}
            
            <div className="space-y-6 mt-6">
               {/* REAL TELEGRAM WIDGET CONTAINER */}
               <div className="flex flex-col items-center justify-center min-h-[50px]">
                  <div ref={telegramWrapperRef} className="flex justify-center w-full"></div>
                  
                  {/* Info text for dev environment */}
                  <p className="text-[10px] text-neutral-700 mt-2 text-center max-w-xs">
                     Если кнопки нет, убедитесь что вы на домене <code>stylevision.vercel.app</code>
                  </p>
               </div>

               {!isOverlay && (
                   <>
                       <div className="relative py-2">
                          <div className="absolute inset-0 flex items-center">
                             <div className="w-full border-t border-neutral-800"></div>
                          </div>
                          <div className="relative flex justify-center text-xs uppercase">
                             <span className="bg-[#0a0a0a] px-2 text-neutral-600">Или продолжить как гость</span>
                          </div>
                       </div>

                       {/* Browser fallback login form */}
                       <form onSubmit={handleGuestLogin} className="space-y-4">
                          <input 
                            type="text" 
                            value={mockName}
                            onChange={(e) => setMockName(e.target.value)}
                            placeholder="Ваше имя"
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:border-amber-600 focus:outline-none transition-colors"
                          />
                          <button 
                            type="submit"
                            disabled={!mockName.trim()}
                            className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-neutral-200 transition-colors disabled:opacity-50 uppercase tracking-wider text-xs"
                          >
                             Начать работу
                          </button>
                       </form>
                   </>
               )}
            </div>
            
            <p className="mt-6 text-[10px] text-neutral-600 text-center leading-relaxed">
               Ваша подписка и история стилей будут привязаны к вашему аккаунту Telegram.
            </p>
         </div>
      </div>
    </div>
  );
};

export default LoginScreen;