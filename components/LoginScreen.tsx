import React, { useState, useEffect, useRef } from 'react';
import { TelegramUser } from '../types';

interface LoginScreenProps {
  onLogin: (user: TelegramUser) => void;
  isOverlay?: boolean;
  onCancel?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isOverlay = false, onCancel }) => {
  const [mockName, setMockName] = useState('');
  const telegramWrapperRef = useRef<HTMLDivElement>(null);

  // 1. SETUP TELEGRAM WIDGET
  useEffect(() => {
    // 1. Define global callback
    (window as any).onTelegramAuth = (user: any) => {
      console.log("Telegram Auth Success:", user);
      onLogin({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url,
        isGuest: false
      });
    };

    // 2. Prepare script
    const script = document.createElement('script');
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.setAttribute('data-telegram-login', 'stylevision_bot'); 
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '12');
    // Restoration: 'write' access often helps with code delivery and bot permissions
    script.setAttribute('data-request-access', 'write'); 
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.async = true;

    // 3. Inject
    if (telegramWrapperRef.current) {
        telegramWrapperRef.current.innerHTML = ''; // Clean previous
        telegramWrapperRef.current.appendChild(script);
    }

    return () => {
        // Cleanup to prevent memory leaks or conflicts
        delete (window as any).onTelegramAuth;
        if (telegramWrapperRef.current) {
            telegramWrapperRef.current.innerHTML = '';
        }
    };
  }, [onLogin]);

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockName.trim()) return;

    const guestUser: TelegramUser = {
      id: Date.now(),
      first_name: mockName,
      username: `guest_${Date.now()}`,
      isGuest: true
    };
    onLogin(guestUser);
  };

  const containerClasses = isOverlay 
    ? "fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
    : "min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden";

  return (
    <div className={containerClasses}>
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
                {isOverlay ? 'Требуется авторизация' : 'Вход через Telegram'}
            </h2>
            
            <div className="space-y-6 mt-6">
               <div className="flex flex-col items-center justify-center min-h-[50px] bg-white/5 rounded-lg p-4">
                  <div ref={telegramWrapperRef} className="flex justify-center w-full"></div>
               </div>

               <div className="text-[10px] text-neutral-500 text-center leading-relaxed bg-neutral-900/50 p-3 rounded border border-neutral-800">
                  <p className="mb-2">⚠️ <strong>Код не приходит?</strong></p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-400 text-left px-2">
                      <li>Проверьте приложение Telegram (чат "Telegram").</li>
                      <li>Если не помогло: найдите бота <strong>@stylevision_bot</strong> и нажмите <span className="text-amber-500 font-mono">/start</span> или "Перезапустить".</li>
                      <li>Обновите эту страницу.</li>
                  </ol>
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
                             Войти без Telegram
                          </button>
                       </form>
                   </>
               )}
            </div>
         </div>
      </div>
    </div>
  );
};

export default LoginScreen;