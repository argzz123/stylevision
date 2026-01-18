
import React, { useState, useEffect, useRef } from 'react';
import { TelegramUser } from '../types';

interface LoginScreenProps {
  onLogin: (user: TelegramUser) => void;
  isOverlay?: boolean;
  onCancel?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, isOverlay = false, onCancel }) => {
  const [mockName, setMockName] = useState('');
  const [showWwwWarning, setShowWwwWarning] = useState(false);
  const telegramWrapperRef = useRef<HTMLDivElement>(null);
  
  // Checkbox states
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  
  // Modal states
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  const loadWidget = () => {
     if (!telegramWrapperRef.current) return;
     telegramWrapperRef.current.innerHTML = '';
     const script = document.createElement('script');
     script.src = "https://telegram.org/js/telegram-widget.js?22";
     script.setAttribute('data-telegram-login', 'stylevision_bot'); 
     script.setAttribute('data-size', 'large');
     script.setAttribute('data-radius', '12');
     script.setAttribute('data-onauth', 'onTelegramAuth(user)');
     script.async = true;
     telegramWrapperRef.current.appendChild(script);
  };

  useEffect(() => {
    const hostname = window.location.hostname;
    if (hostname.startsWith('www.')) setShowWwwWarning(true);

    (window as any).onTelegramAuth = (user: any) => {
      // Validation Check inside callback
      if (!(document.getElementById('check_terms') as HTMLInputElement)?.checked || 
          !(document.getElementById('check_privacy') as HTMLInputElement)?.checked) {
          alert("Для входа необходимо принять Пользовательское соглашение и Политику конфиденциальности.");
          return;
      }
      
      onLogin({
        id: user.id,
        first_name: user.first_name,
        last_name: user.last_name,
        username: user.username,
        photo_url: user.photo_url,
        isGuest: false,
        termsAcceptedAt: new Date().toISOString() // Save timestamp
      });
    };

    loadWidget();

    return () => {
        delete (window as any).onTelegramAuth;
        if (telegramWrapperRef.current) telegramWrapperRef.current.innerHTML = '';
    };
  }, [onLogin]);

  const handleGuestLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mockName.trim()) return;
    
    if (!termsAccepted || !privacyAccepted) {
        alert("Пожалуйста, примите условия соглашений.");
        return;
    }

    const guestUser: TelegramUser = {
      id: Date.now(),
      first_name: mockName,
      username: `guest_${Date.now()}`,
      isGuest: true,
      termsAcceptedAt: new Date().toISOString()
    };
    onLogin(guestUser);
  };

  const areCheckboxesChecked = termsAccepted && privacyAccepted;

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
      
      {/* TERMS MODAL */}
      {showTermsModal && (
          <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4">
              <div className="bg-[#111] border border-neutral-800 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                  <h3 className="text-xl font-bold text-white mb-4">Пользовательское соглашение</h3>
                  <div className="text-sm text-neutral-400 space-y-3 leading-relaxed">
                      <p>1. Общие положения. Настоящее Соглашение определяет условия использования пользователями материалов и сервисов сайта/приложения StyleVision AI.</p>
                      <p>2. Обязательства Пользователя. Пользователь соглашается не предпринимать действий, которые могут рассматриваться как нарушающие российское законодательство или нормы международного права, в том числе в сфере интеллектуальной собственности.</p>
                      <p>3. Сервис предоставляется «как есть». Администрация не гарантирует, что качество сервисов будет соответствовать ожиданиям Пользователя.</p>
                      <p>4. Оплата. Платежи обрабатываются через сторонние сервисы (ЮKassa). Мы не храним данные ваших карт.</p>
                  </div>
                  <button onClick={() => setShowTermsModal(false)} className="mt-6 w-full bg-amber-600 text-black font-bold py-3 rounded">Закрыть</button>
              </div>
          </div>
      )}

      {/* PRIVACY MODAL */}
      {showPrivacyModal && (
          <div className="fixed inset-0 z-[150] bg-black/95 flex items-center justify-center p-4">
              <div className="bg-[#111] border border-neutral-800 rounded-xl p-6 max-w-lg w-full max-h-[80vh] overflow-y-auto">
                  <h3 className="text-xl font-bold text-white mb-4">Политика конфиденциальности</h3>
                  <div className="text-sm text-neutral-400 space-y-3 leading-relaxed">
                      <p>1. Мы собираем минимально необходимый набор данных для функционирования сервиса: ID пользователя Telegram, имя пользователя, загруженные фотографии.</p>
                      <p>2. Загруженные фотографии обрабатываются алгоритмами ИИ и сохраняются в зашифрованном виде в истории вашего профиля.</p>
                      <p>3. Мы не передаем ваши личные данные третьим лицам, за исключением случаев, предусмотренных законодательством РФ.</p>
                      <p>4. Вы можете в любой момент запросить удаление всех ваших данных, обратившись в поддержку:</p>
                      <a href="https://t.me/Nikita_Peredvigin" target="_blank" rel="noopener noreferrer" className="text-amber-500 hover:text-amber-400 inline-flex items-center gap-1">
                          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                          @Nikita_Peredvigin
                      </a>
                  </div>
                  <button onClick={() => setShowPrivacyModal(false)} className="mt-6 w-full bg-amber-600 text-black font-bold py-3 rounded">Закрыть</button>
              </div>
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
            
            {/* Legal Checkboxes */}
            <div className="space-y-3 mt-4 mb-6 bg-neutral-900/50 p-4 rounded-lg border border-neutral-800">
               <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="check_terms" 
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-amber-600 cursor-pointer" 
                  />
                  <label htmlFor="check_terms" className="text-xs text-neutral-400 cursor-pointer select-none">
                     Я принимаю условия <span onClick={(e) => {e.preventDefault(); setShowTermsModal(true)}} className="text-amber-500 hover:text-amber-400 underline cursor-pointer">Пользовательского соглашения</span>
                  </label>
               </div>
               <div className="flex items-start gap-3">
                  <input 
                    type="checkbox" 
                    id="check_privacy"
                    checked={privacyAccepted}
                    onChange={(e) => setPrivacyAccepted(e.target.checked)}
                    className="mt-1 w-4 h-4 accent-amber-600 cursor-pointer" 
                  />
                  <label htmlFor="check_privacy" className="text-xs text-neutral-400 cursor-pointer select-none">
                     Я даю согласие на обработку персональных данных согласно <span onClick={(e) => {e.preventDefault(); setShowPrivacyModal(true)}} className="text-amber-500 hover:text-amber-400 underline cursor-pointer">Политике конфиденциальности</span>
                  </label>
               </div>
            </div>

            <div className={`space-y-6 transition-opacity ${areCheckboxesChecked ? 'opacity-100' : 'opacity-50 pointer-events-none'}`}>
               
               {/* Telegram Widget */}
               <div className="flex flex-col items-center justify-center min-h-[50px] bg-white/5 rounded-lg p-4 relative">
                  <div ref={telegramWrapperRef} className="flex justify-center w-full min-h-[40px] z-10 relative"></div>
               </div>
               
               {/* Help / Error Message */}
               <div className="bg-amber-900/10 border border-amber-900/30 p-4 rounded text-xs text-neutral-400 mt-4 text-center">
                  <p className="text-white font-bold mb-2">Не получается войти?</p>
                  <p className="leading-relaxed opacity-80 mb-3">
                     Наблюдаются сбои с авторизацией через Telegram. Если кнопка не работает или не появляется, перейдите напрямую в нашего бота:
                  </p>
                  <a 
                    href="https://t.me/stylevision_bot" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 bg-[#2AABEE] text-white px-4 py-2 rounded-full font-bold hover:bg-[#229ED9] transition-colors"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    Перейти в @stylevision_bot
                  </a>
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
                            disabled={!areCheckboxesChecked}
                            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-4 py-3 text-white placeholder-neutral-600 focus:border-amber-600 focus:outline-none transition-colors disabled:opacity-50"
                          />
                          <button 
                            type="submit"
                            disabled={!mockName.trim() || !areCheckboxesChecked}
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
