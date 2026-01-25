
import React, { useState, useEffect, useRef } from 'react';
import { TelegramUser } from '../types';
import { triggerHaptic } from '../utils/haptics';

interface LoginScreenProps {
  onLogin: (user: TelegramUser) => void;
  isOverlay?: boolean;
  onCancel?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isOverlay = false, onCancel }) => {
  const [mockName, setMockName] = useState('');
  const telegramWrapperRef = useRef<HTMLDivElement>(null);
  
  // Checkbox states
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [showAgreementError, setShowAgreementError] = useState(false);

  useEffect(() => {
    // Clean container first
    if (telegramWrapperRef.current) {
        telegramWrapperRef.current.innerHTML = '';
    }

    const loadWidget = () => {
         if (!telegramWrapperRef.current) return;
         
         const script = document.createElement('script');
         script.src = "https://telegram.org/js/telegram-widget.js?22";
         script.setAttribute('data-telegram-login', 'stylevision_bot'); 
         script.setAttribute('data-size', 'large');
         script.setAttribute('data-radius', '12');
         script.setAttribute('data-onauth', 'onTelegramAuth(user)');
         script.async = true;
         telegramWrapperRef.current.appendChild(script);
    };

    (window as any).onTelegramAuth = (user: any) => {
      if (!(document.getElementById('check_terms') as HTMLInputElement)?.checked || 
          !(document.getElementById('check_privacy') as HTMLInputElement)?.checked) {
          setShowAgreementError(true);
          triggerHaptic('error');
          return;
      }
      
      onLogin({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url,
        isGuest: false,
        termsAcceptedAt: new Date().toISOString()
      });
    };

    loadWidget();

    return () => {
        // Optional cleanup
    };
  }, [onLogin]);

  useEffect(() => {
    if (termsAccepted && privacyAccepted) {
        setShowAgreementError(false);
    }
  }, [termsAccepted, privacyAccepted]);

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = mockName.trim();
    if (!cleanName) return;
    
    // --- MODERATOR BACKDOOR START ---
    if (cleanName === 'gehvdu54vgs') {
        const modUser: TelegramUser = {
            id: 999999, // Special ID for moderator
            first_name: "YooKassa Moderator",
            username: "moderator",
            photo_url: "",
            isGuest: false, // CRITICAL: Treat as authenticated user
            termsAcceptedAt: new Date().toISOString()
        };
        triggerHaptic('success');
        onLogin(modUser);
        return;
    }
    // --- MODERATOR BACKDOOR END ---
    
    if (!termsAccepted || !privacyAccepted) {
        setShowAgreementError(true);
        triggerHaptic('error');
        return;
    }

    const guestUser: TelegramUser = {
      id: Date.now(),
      first_name: cleanName,
      username: `guest_${Date.now()}`,
      isGuest: true,
      termsAcceptedAt: new Date().toISOString()
    };
    onLogin(guestUser);
  };

  const areCheckboxesChecked = termsAccepted && privacyAccepted;

  const handleOverlayClick = () => {
      if (!areCheckboxesChecked) {
          setShowAgreementError(true);
          triggerHaptic('warning');
      }
  };

  const containerClasses = isOverlay 
    ? "fixed inset-0 z-[100] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4"
    : "min-h-screen w-full bg-[#050505] flex flex-col items-center justify-center p-4 relative overflow-hidden";

  const renderCheckbox = (id: string, checked: boolean, setter: (v: boolean) => void, label: React.ReactNode) => (
      <div className="flex items-start gap-3">
          <div className="relative flex items-center pt-0.5">
            <input 
                type="checkbox" 
                id={id} 
                checked={checked}
                onChange={(e) => { triggerHaptic('selection'); setter(e.target.checked); }}
                className={`
                    appearance-none w-5 h-5 border rounded bg-neutral-900 
                    checked:bg-amber-600 checked:border-amber-600 
                    cursor-pointer transition-colors shrink-0 z-10
                    ${showAgreementError && !checked ? 'border-red-500' : 'border-neutral-700'}
                `} 
            />
            <svg className={`
                absolute top-0.5 left-0 w-5 h-5 pointer-events-none text-black transition-opacity z-20 p-0.5
                ${checked ? 'opacity-100' : 'opacity-0'}
            `} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <label htmlFor={id} className={`text-xs cursor-pointer select-none pt-0.5 leading-tight ${showAgreementError && !checked ? 'text-red-400' : 'text-neutral-400'}`}>
              {label}
          </label>
      </div>
  );

  return (
    <div className={containerClasses}>
      {!isOverlay && (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-amber-900/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 rounded-full blur-[120px]"></div>
        </div>
      )}
      
      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
         {!isOverlay && (
             <div className="text-center mb-10">
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
            
            <div className={`space-y-6 mt-6`}>
               
               {/* Login Widget */}
               <div className="relative">
                   {!areCheckboxesChecked && (
                       <div className="absolute inset-0 z-20 cursor-pointer" onClick={handleOverlayClick}></div>
                   )}
                   
                   <div className="flex flex-col items-center justify-center min-h-[50px] bg-white/5 rounded-lg p-4 relative transition-colors">
                      <div ref={telegramWrapperRef} className="flex justify-center w-full min-h-[40px] z-10 relative"></div>
                   </div>
               </div>

               {/* Trouble Logging In? (Fallback) */}
               <div className="text-center pt-1">
                   <p className="text-[10px] text-neutral-500 mb-2 leading-relaxed">
                       Не удается войти? Если виджет не работает,<br/>перейдите напрямую в нашего бота:
                   </p>
                   <a 
                      href="https://t.me/stylevision_bot" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-xs font-medium text-amber-500 hover:text-amber-400 bg-amber-900/10 hover:bg-amber-900/20 border border-amber-900/30 rounded-lg px-4 py-2 transition-all"
                   >
                      <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                      Перейти в @stylevision_bot
                   </a>
               </div>

               {/* Legal Checkboxes */}
               <div className={`space-y-3 p-4 rounded-lg border transition-all ${showAgreementError ? 'bg-red-900/10 border-red-500/50' : 'bg-neutral-900/50 border-neutral-800'}`}>
                   {showAgreementError && (
                       <div className="text-center mb-3">
                           <span className="text-xs font-bold text-red-500 bg-red-900/20 px-2 py-1 rounded animate-pulse">
                               Необходимо принять условия
                           </span>
                       </div>
                   )}
                   
                   {renderCheckbox(
                       "check_terms", 
                       termsAccepted, 
                       setTermsAccepted, 
                       <>Я принимаю условия <a href="/offer.html" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 underline cursor-pointer">Публичной оферты</a></>
                   )}
                   
                   {renderCheckbox(
                       "check_privacy", 
                       privacyAccepted, 
                       setPrivacyAccepted, 
                       <>Я даю согласие на обработку персональных данных согласно <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 underline cursor-pointer">Политике конфиденциальности</a></>
                   )}
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
