
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeUserImage, getStyleRecommendations, editUserImage, IS_DEMO_MODE } from './services/geminiService';
import { createPayment, PaymentResponse, checkPaymentStatus } from './services/paymentService';
import { storageService, GlobalConfig } from './services/storageService'; 
import { AppState, UserAnalysis, StyleRecommendation, AnalysisMode, Store, Season, Occasion, HistoryItem, MobileTab, TelegramUser } from './types';
import StyleCard from './components/StyleCard';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import LoginScreen from './components/LoginScreen';
import AdminPanel from './components/AdminPanel'; 

// ADMIN ID CONSTANT (Array)
const ADMIN_IDS = [643780299, 1613288376];

const FREE_LIMIT = 2; // Max generations per 5 hours

// Configuration for available stores
const INITIAL_STORES: Store[] = [
  { id: 'lamoda', name: 'Lamoda', domain: 'lamoda.ru', logoUrl: 'https://logo-teka.com/wp-content/uploads/2025/07/lamoda-icon-logo.svg', isSelected: true },
  { id: 'ozon', name: 'Ozon', domain: 'ozon.ru', logoUrl: 'https://logo-teka.com/wp-content/uploads/2025/06/ozon-icon-logo.svg', isSelected: true },
  { id: 'wb', name: 'Wildberries', domain: 'wildberries.ru', logoUrl: 'https://logo-teka.com/wp-content/uploads/2025/06/wildberries-sign-logo.svg', isSelected: false },
  { id: 'mfg', name: 'Melon Fashion Group', domain: 'zarina.ru OR befree.ru OR loverepublic.ru OR sela.ru', logoUrl: 'https://habrastorage.org/getpro/moikrug/uploads/company/100/005/693/5/logo/medium_9392a1cdb2b0e7a6ecd5a376e70fb44d.png', isSelected: false },
  { id: 'lime', name: 'Lime', domain: 'lime-shop.com', logoUrl: 'https://habrastorage.org/getpro/moikrug/uploads/company/100/008/062/6/logo/medium_17a6c9fb54ab00a70951c63e7c21425d.jpg', isSelected: false },
  { id: 'gj', name: 'Gloria Jeans', domain: 'gloria-jeans.ru', logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/3/32/GJ_Logo_3.jpg', isSelected: false },
  { id: '12storeez', name: '12 Storeez', domain: '12storeez.com', logoUrl: 'https://habrastorage.org/getpro/moikrug/uploads/company/100/006/613/6/logo/medium_0859333663d6164186023050fb10a939.jpg', isSelected: false },
  { id: 'sportmaster', name: 'Sportmaster', domain: 'sportmaster.ru', logoUrl: 'https://logo-teka.com/wp-content/uploads/2025/07/sportmaster-vertical-logo.svg', isSelected: false },
  { id: 'rendezvous', name: 'Rendez-Vous', domain: 'rendez-vous.ru', logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRiFJirlzeyOzjuiX-RknG1hrRdKTtC3dffzg&s', isSelected: false },
];

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<TelegramUser | null>(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // App Flow State
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [setupStep, setSetupStep] = useState<number>(1);
  const [isPro, setIsPro] = useState(false);
  
  // Config State
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({ 
      price: "1.00", 
      productTitle: "StyleVision PRO", 
      productDescription: "",
      maintenanceMode: false
  });
  
  // Overlays
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAuthRequest, setShowAuthRequest] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false); 
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showGuestLockModal, setShowGuestLockModal] = useState(false);
  
  // Data State
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<UserAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // Settings State
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('STANDARD');
  const [showObjectiveWarning, setShowObjectiveWarning] = useState(false);
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [selectedSeason, setSelectedSeason] = useState<Season>('ANY');
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion>('CASUAL');

  // History State
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  
  // Mobile Tab State
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('COLLECTION');
  
  // Editing State
  const [editPrompt, setEditPrompt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Is Admin?
  const isAdmin = (id: number) => ADMIN_IDS.includes(id);

  // Initialize and Check Session
  useEffect(() => {
    const initApp = async () => {
        // Load global pricing config
        const config = await storageService.getGlobalConfig();
        setGlobalConfig(config);

        // 1. Check if running inside Telegram WebApp
        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
            tg.ready();
            tg.expand();
            const tgUser = tg.initDataUnsafe?.user;
            if (tgUser) {
                const fullUser = { ...tgUser, isGuest: false };
                setUser(fullUser);
                localStorage.setItem('stylevision_current_user', JSON.stringify(fullUser));
                await storageService.saveUser(fullUser);
                await loadUserData(tgUser.id);
                setIsAuthChecking(false);
                return;
            }
        }

        // 2. Check LocalStorage for persistent session (Fix for refresh issue)
        const storedUser = localStorage.getItem('stylevision_current_user');
        if (storedUser) {
            try {
                const parsedUser = JSON.parse(storedUser);
                setUser(parsedUser);
                await storageService.saveUser(parsedUser);
                await loadUserData(parsedUser.id);
                setIsAuthChecking(false);
                return;
            } catch (e) {
                console.error("Failed to restore session", e);
            }
        }

        setIsAuthChecking(false);
    };

    initApp();
  }, []);

  // Memoized to prevent LoginScreen re-renders which reload the Widget
  const handleLogin = useCallback(async (userData: TelegramUser) => {
     setUser(userData);
     localStorage.setItem('stylevision_current_user', JSON.stringify(userData)); // Persist session
     
     await storageService.saveUser(userData); // Async persist to DB
     await loadUserData(userData.id);
     setIsAuthChecking(false);
  }, []);

  const handleUpgradeAccount = useCallback(async (upgradedUser: TelegramUser) => {
     setUser(upgradedUser);
     localStorage.setItem('stylevision_current_user', JSON.stringify(upgradedUser));
     await storageService.saveUser(upgradedUser); 
     setShowAuthRequest(false);
     setShowPaymentModal(true);
  }, []);

  const loadUserData = async (userId: number) => {
    // 1. Load History via Service (Async)
    const savedHistory = await storageService.getHistory(userId);
    setHistory(savedHistory);

    // 2. Check Pro Status via Service (Async)
    let proStatus = await storageService.getProStatus(userId);

    // 3. Payment Verification (Robust Check)
    const pendingPaymentId = localStorage.getItem('pending_payment_id');
    if (pendingPaymentId) {
        setProcessingMessage('Проверка платежа...');
        // We show a subtle loading state logic if needed, but for now just check
        const isPaid = await checkPaymentStatus(pendingPaymentId);
        
        if (isPaid) {
            proStatus = true;
            await storageService.setProStatus(userId, true);
            alert("Оплата прошла успешно! PRO режим активирован.");
            setShowPaymentModal(false);
        }
        // Clean up pending ID regardless of result so we don't loop check
        localStorage.removeItem('pending_payment_id');
    }
    
    setIsPro(proStatus);
  };

  // Helper to check limits
  const checkLimit = async (): Promise<boolean> => {
     if (!user) return false;
     if (isPro) return true;

     const count = await storageService.getRecentGenerationsCount(user.id, 5); // Check last 5 hours
     if (count >= FREE_LIMIT) {
         setShowLimitModal(true);
         return false;
     }
     return true;
  };

  const saveToHistory = async (img: string, styleName: string) => {
    if (!originalImage || !analysis || !user) return;

    try {
        const newItem: HistoryItem = {
          id: Date.now().toString(), // Client-side ID for UI, DB will generate UUID
          date: new Date().toLocaleDateString('ru-RU'),
          originalImage: originalImage,
          resultImage: img,
          styleTitle: styleName,
          analysis: analysis, 
          recommendations: recommendations
        };

        // Update State immediately for responsiveness
        setHistory(prev => [newItem, ...prev].slice(0, 20));
        
        // Persist via Service (Async)
        await storageService.saveHistoryItem(user.id, newItem);

    } catch (err) {
        console.error("Error saving history:", err);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
     setOriginalImage(item.originalImage);
     setCurrentImage(item.resultImage);
     setAppState(AppState.RESULTS);
     setShowHistory(false);
     setSetupStep(1); 
     
     if (item.analysis) setAnalysis(item.analysis);
     if (item.recommendations) {
        setRecommendations(item.recommendations);
        if (item.recommendations.length > 0) setSelectedStyleId(item.recommendations[0].id);
     }
     
     setActiveMobileTab('STUDIO');
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appState, setupStep]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setOriginalImage(base64);
        setCurrentImage(base64);
        setAppState(AppState.PREVIEW);
        setSetupStep(1);
        setAnalysisMode('STANDARD');
      };
      reader.readAsDataURL(file);
    }
  };

  const handleModeChange = (mode: AnalysisMode) => {
    setAnalysisMode(mode);
    setShowObjectiveWarning(mode === 'OBJECTIVE');
  };

  const toggleStore = (storeId: string) => {
    setStores(prev => prev.map(store => 
      store.id === storeId ? { ...store, isSelected: !store.isSelected } : store
    ));
  };

  const handleBuyProClick = () => {
      if (user?.isGuest) {
          setShowAuthRequest(true);
          return;
      }
      setShowPaymentModal(true);
      setShowLimitModal(false);
  };

  const initiatePayment = async () => {
    if (!user) return;
    if (user.isGuest) {
        setShowPaymentModal(false);
        setShowAuthRequest(true);
        return;
    }

    try {
        setIsProcessing(true);
        setProcessingMessage('Соединение с ЮKassa...');
        
        // Use global config for price and description
        const payment = await createPayment(globalConfig.price, globalConfig.productDescription || "Подписка StyleVision PRO");
        
        if (payment.confirmation && payment.confirmation.confirmation_url) {
            window.location.href = payment.confirmation.confirmation_url;
        } else {
             throw new Error("Не получена ссылка на оплату");
        }
    } catch (e: any) {
        console.error(e);
        setIsProcessing(false);
        alert(`Ошибка оплаты: ${e.message}.`);
    }
  };

  const performAnalysis = async () => {
     // GUEST BLOCK CHECK
     if (user?.isGuest) {
         setShowGuestLockModal(true);
         return;
     }

     try {
      setAppState(AppState.ANALYZING);
      setIsProcessing(true);
      setProcessingMessage('Анализируем ваш профиль...');
      
      const analysisResult = await analyzeUserImage(originalImage!, analysisMode);
      setAnalysis(analysisResult);
      
      setProcessingMessage(`Ищем образы (${selectedSeason === 'ANY' ? 'база' : selectedSeason})...`);
      
      const styles = await getStyleRecommendations(analysisResult, stores, {
        season: selectedSeason,
        occasion: selectedOccasion
      });
      setRecommendations(styles);
      if (styles.length > 0) setSelectedStyleId(styles[0].id);
      
      setActiveMobileTab('COLLECTION'); 
      setAppState(AppState.RESULTS);
    } catch (error: any) {
      console.error(error);
      // SHOW REAL ERROR MESSAGE TO USER
      alert(error.message || 'Ошибка анализа.');
      setAppState(AppState.UPLOAD);
    } finally {
      setIsProcessing(false);
    }
  }

  const startFlow = () => performAnalysis();

  const handleApplyStyle = async (style: StyleRecommendation) => {
    if (!originalImage || !analysis) return;
    
    // GUEST BLOCK CHECK
    if (user?.isGuest) {
        setShowGuestLockModal(true);
        return;
    }

    // Check Limit
    const canProceed = await checkLimit();
    if (!canProceed) return;

    try {
      setIsProcessing(true);
      setActiveMobileTab('STUDIO'); 
      
      // Fix: Safely handle undefined title with fallback
      const safeTitle = style.title || "Стильный образ";
      setProcessingMessage(`Примеряем образ "${safeTitle}"...`);
      
      const itemList = (style.items || []).map(item => item.name).join(', ');
      const colors = (style.colorPalette || []).join(', ');
      
      const prompt = `
        TASK: High-End Photorealistic Virtual Try-On.
        SUBJECT: ${analysis.gender}.
        BODY TYPE: ${analysis.bodyType}.
        ACTION: Replace the current outfit with: ${itemList}.
        STYLE AESTHETIC: ${safeTitle}.
        COLOR PALETTE: ${colors}.
        CRITICAL RENDERING INSTRUCTIONS:
        1. PRESERVE IDENTITY: Do NOT change the face.
        2. QUALITY: 8k resolution, photorealistic.
      `;
      
      const newImage = await editUserImage(originalImage, prompt);
      setCurrentImage(newImage);
      
      // Saving runs in background
      saveToHistory(newImage, safeTitle);

    } catch (error) {
      console.error(error);
      alert('Не удалось примерить стиль.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!currentImage || !editPrompt.trim()) return;

     // GUEST BLOCK CHECK
     if (user?.isGuest) {
         setShowGuestLockModal(true);
         return;
     }

     // Check Limit
     const canProceed = await checkLimit();
     if (!canProceed) return;

     try {
        setIsProcessing(true);
        setProcessingMessage('Редактируем фото...');
        const newImage = await editUserImage(currentImage, editPrompt);
        setCurrentImage(newImage);
        
        // Background save
        saveToHistory(newImage, "Edit: " + editPrompt);
        
        setEditPrompt('');
     } catch (err) {
        console.error(err);
        alert("Ошибка редактирования");
     } finally {
        setIsProcessing(false);
     }
  }

  const resetApp = () => {
    setAppState(AppState.UPLOAD);
    setSetupStep(1);
    setOriginalImage(null);
    setCurrentImage(null);
    setAnalysis(null);
    setRecommendations([]);
  };

  const handleLogout = () => {
     setUser(null);
     localStorage.removeItem('stylevision_current_user');
     setAppState(AppState.UPLOAD);
     setHistory([]);
  };

  const handleGuestToLogin = () => {
      setShowGuestLockModal(false);
      handleLogout(); // This will clear guest session and show LoginScreen
  };

  // 1. Loading
  if (isAuthChecking) {
    return (
        <div className="min-h-screen bg-[#050505] flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-t-2 border-amber-500 rounded-full"></div>
        </div>
    );
  }

  // 2. Login
  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  // 3. Maintenance Mode (Block non-admins)
  if (globalConfig.maintenanceMode && !isAdmin(user.id)) {
      return (
          <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="w-24 h-24 bg-yellow-900/20 border border-yellow-600/50 rounded-full flex items-center justify-center mb-8">
                  <svg className="w-12 h-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
              </div>
              <h1 className="text-3xl font-serif text-white mb-4">Мы обновляемся</h1>
              <p className="text-neutral-400 max-w-md mb-8 leading-relaxed">
                  В данный момент проводятся технические работы для улучшения сервиса. Мы скоро вернемся! Приносим извинения за неудобства.
              </p>
              
              <div className="border-t border-neutral-800 pt-6 w-full max-w-xs">
                  <p className="text-xs text-neutral-500 uppercase tracking-widest mb-3">Связаться с нами</p>
                  <a href="https://t.me/Nikita_Peredvigin" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 bg-[#2AABEE] hover:bg-[#229ED9] text-white py-3 rounded-lg font-bold transition-colors">
                     <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                     @Nikita_Peredvigin
                  </a>
              </div>
          </div>
      );
  }

  // 4. Main UI
  return (
    <div className="min-h-screen bg-[#050505] text-neutral-300 font-sans flex flex-col pb-20 md:pb-0">
      
      {/* Banner */}
      <div className="bg-amber-600 text-black text-[10px] font-bold text-center py-1 tracking-[0.2em] uppercase sticky top-0 z-[60]">
        Режим Презентации • Приложение в разработке
      </div>

      {/* Header */}
      <header className="sticky top-[22px] z-50 backdrop-blur-md bg-black/80 border-b border-neutral-800">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* Logo / Home */}
          <div className="flex items-center gap-3 cursor-pointer group" onClick={resetApp}>
            <div className="w-8 h-8 border border-neutral-700 flex items-center justify-center bg-neutral-900">
              <span className="font-serif text-xl text-amber-500">S</span>
            </div>
            <h1 className="text-xl font-serif text-white tracking-widest hidden md:block">
              STYLE<span className="font-sans font-light text-neutral-500 text-sm ml-1">VISION</span>
            </h1>
          </div>
          
          <div className="flex items-center gap-4">
             
             {/* Return to Home Button (Visible in sub-states) */}
             {appState !== AppState.UPLOAD && (
                 <button 
                    onClick={resetApp}
                    className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-400 hover:text-white transition-colors border border-neutral-800 rounded-full px-3 py-1.5 bg-neutral-900/50"
                 >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                     <span className="hidden sm:inline">На Главную</span>
                 </button>
             )}

             {/* ADMIN BUTTON (Only visible to admin) */}
             {isAdmin(user.id) && (
                <button 
                  onClick={() => setShowAdminPanel(true)}
                  className="bg-red-900/20 border border-red-900 text-red-500 text-xs font-bold px-3 py-1 rounded hover:bg-red-900/40 transition-colors hidden sm:block"
                >
                  ADMIN
                </button>
             )}

             <div 
                onClick={handleLogout}
                className={`hidden md:flex cursor-pointer items-center gap-2 text-xs border border-neutral-800 rounded-full px-3 py-1 bg-neutral-900 hover:bg-red-900/10 hover:border-red-900/30 transition-all group ${user.isGuest ? 'text-neutral-500' : 'text-amber-500 border-amber-900/30'}`}
                title="Нажмите чтобы выйти"
             >
                <span className={`w-2 h-2 rounded-full ${user.isGuest ? 'bg-neutral-500' : 'bg-green-500'}`}></span>
                {user.username || user.first_name}
             </div>

             {!isPro && (
                <button 
                  onClick={handleBuyProClick}
                  className="bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black text-xs font-bold px-4 py-2 rounded-full transition-all shadow-lg shadow-amber-900/20 flex items-center gap-1.5"
                >
                    <span className="hidden sm:inline">Купить PRO</span>
                    <span className="sm:hidden">PRO</span>
                </button>
             )}
             
             <button onClick={() => setShowHistory(true)} className="text-neutral-400 hover:text-white flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" /></svg>
                <span className="hidden md:inline text-xs uppercase font-bold">Гардероб</span>
             </button>
          </div>
        </div>
      </header>

      {/* ADMIN PANEL OVERLAY */}
      {showAdminPanel && isAdmin(user.id) && (
         <AdminPanel onClose={() => setShowAdminPanel(false)} currentUserId={user.id} />
      )}

      {/* GUEST LOCK MODAL */}
      {showGuestLockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-[#0a0a0a] border border-amber-900/50 rounded-2xl p-8 shadow-2xl overflow-hidden">
                <button onClick={() => setShowGuestLockModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                        <span className="text-3xl">🔒</span>
                    </div>
                    <h2 className="text-2xl font-serif text-white mb-3">Только для авторизованных</h2>
                    <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                        Гостевой режим позволяет только загрузить фото. Чтобы создать персональный стиль, примерить образы и использовать редактор, пожалуйста, войдите через Telegram.
                    </p>

                    <button 
                        onClick={handleGuestToLogin}
                        className="w-full bg-white text-black font-bold py-3.5 rounded-xl hover:bg-neutral-200 transition-colors uppercase tracking-wider text-xs"
                    >
                        Войти через Telegram
                    </button>
                </div>
            </div>
         </div>
      )}

      {/* LIMIT MODAL */}
      {showLimitModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-[#0a0a0a] border border-amber-900/50 rounded-2xl p-8 shadow-2xl overflow-hidden">
                <button onClick={() => setShowLimitModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center">
                        <span className="text-3xl">⏳</span>
                    </div>
                    <h2 className="text-2xl font-serif text-white mb-3">Лимит исчерпан</h2>
                    <p className="text-neutral-400 text-sm mb-6 leading-relaxed">
                        В бесплатной версии доступно только <strong>{FREE_LIMIT} генерации</strong> каждые 5 часов. 
                        Вы можете подождать или снять все ограничения прямо сейчас.
                    </p>

                    <div className="space-y-3">
                        <button 
                            onClick={handleBuyProClick}
                            className="w-full bg-gradient-to-r from-amber-600 to-amber-500 text-black font-bold py-3.5 rounded-xl hover:brightness-110 transition-all shadow-lg"
                        >
                            Снять лимиты за {globalConfig.price}₽
                        </button>
                        <button 
                            onClick={() => setShowLimitModal(false)}
                            className="w-full bg-neutral-900 text-neutral-400 hover:text-white font-medium py-3.5 rounded-xl border border-neutral-800 transition-colors"
                        >
                            Вернуться позже
                        </button>
                    </div>
                </div>
            </div>
         </div>
      )}

      {/* History Drawer */}
      {showHistory && (
         <div className="fixed inset-0 z-[60] flex justify-end">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
            <div className="relative w-full max-w-md bg-[#0a0a0a] border-l border-neutral-800 h-full overflow-y-auto p-6 animate-fade-in shadow-2xl">
               <div className="flex justify-between items-center mb-8">
                  <h2 className="font-serif text-2xl text-white">Ваш Гардероб</h2>
                  <button onClick={() => setShowHistory(false)} className="p-2"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
               </div>
               <div className="space-y-6">
                  {history.map((item) => (
                     <div key={item.id} onClick={() => loadFromHistory(item)} className="cursor-pointer group border border-neutral-800 hover:border-amber-600/50 bg-neutral-900 transition-all">
                        <div className="aspect-[3/4] relative overflow-hidden">
                           <img src={item.resultImage || item.originalImage} className="w-full h-full object-cover" alt="History" />
                        </div>
                        <div className="p-4">
                           <h4 className="font-serif text-lg text-white mb-1">{item.styleTitle}</h4>
                           <p className="text-xs text-neutral-500">{item.date}</p>
                           {item.recommendations && (
                              <span className="text-[10px] text-amber-600 border border-amber-900/50 bg-amber-900/10 px-1.5 py-0.5 mt-2 inline-block rounded">
                                 Полный образ
                              </span>
                           )}
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>
      )}

      {/* Auth Request Modal */}
      {showAuthRequest && (
          <LoginScreen 
             onLogin={handleUpgradeAccount} 
             isOverlay={true}
             onCancel={() => setShowAuthRequest(false)}
          />
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-8 shadow-2xl overflow-hidden">
                <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 p-[1px]">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <span className="font-serif text-3xl text-amber-500 italic">S</span>
                        </div>
                    </div>
                    <h2 className="text-2xl font-serif text-white mb-2">{globalConfig.productTitle || "StyleVision PRO"}</h2>
                    
                    {/* Updated Product Description Area */}
                    <div className="bg-neutral-900/50 rounded-xl p-4 border border-neutral-800 mb-6">
                        <div className="flex justify-between items-center mb-3 pb-3 border-b border-neutral-800">
                            <span className="text-neutral-400 text-sm">Стоимость</span>
                            <span className="text-xl font-bold text-white">{globalConfig.price} ₽</span>
                        </div>
                        <div className="text-left text-xs text-neutral-300 space-y-2">
                           {globalConfig.productDescription ? (
                               <p className="whitespace-pre-line leading-relaxed">{globalConfig.productDescription}</p>
                           ) : (
                               <>
                                <p>• Безлимитная генерация образов</p>
                                <p>• Приоритетная обработка (без очереди)</p>
                                <p>• Доступ к функции примерки (Virtual Try-On)</p>
                               </>
                           )}
                        </div>
                    </div>

                    <button 
                        onClick={initiatePayment}
                        disabled={isProcessing}
                        className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                        {isProcessing ? (
                            <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                        ) : (
                            <><span>Оплатить через</span><span className="font-bold">ЮKassa</span></>
                        )}
                    </button>
                    
                    <p className="mt-4 text-[10px] text-neutral-600">
                       Нажимая кнопку, вы соглашаетесь с условиями оферты.
                    </p>
                </div>
            </div>
        </div>
      )}

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Upload State */}
        {appState === AppState.UPLOAD && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in-up">
            <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16 px-4">
              <span className="text-amber-500 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase mb-4 block">AI Stylist</span>
              <h2 className="text-4xl md:text-6xl font-serif mb-6 text-white leading-tight">
                Ваш Идеальный <br /><span className="italic text-neutral-400">Стиль</span>
              </h2>
              <p className="text-neutral-500 text-sm md:text-lg font-light max-w-xl mx-auto">
                 Загрузите фото для анализа внешности и подбора гардероба.
              </p>
            </div>

            <div onClick={() => fileInputRef.current?.click()} className="w-full max-w-md aspect-[3/2] border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900 transition-all cursor-pointer flex flex-col items-center justify-center">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <div className="w-16 h-16 rounded-full border border-neutral-700 flex items-center justify-center bg-black mb-4">
                 <svg className="w-8 h-8 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-white uppercase tracking-widest text-sm">Загрузить фото</p>
            </div>
          </div>
        )}

        {/* Wizard State */}
        {appState === AppState.PREVIEW && originalImage && (
           <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                 {/* Left: Preview */}
                 <div className="hidden md:block relative aspect-[3/4] border border-neutral-800 bg-black">
                    <img src={originalImage} alt="Preview" className="w-full h-full object-cover opacity-90" />
                 </div>

                 {/* Right: Setup */}
                 <div className="space-y-6">
                    {setupStep === 1 ? (
                      <div className="animate-fade-in">
                         <h2 className="text-2xl font-serif text-white mb-6">Создаем контекст</h2>
                         <div className="space-y-6">
                            <div>
                               <label className="text-xs text-amber-600 font-bold uppercase tracking-widest block mb-3">
                                  СЕЗОН
                               </label>
                               <div className="grid grid-cols-3 gap-2">
                                  {[
                                     {id:'SPRING_SUMMER',l:'Весна/Лето'},
                                     {id:'AUTUMN_WINTER',l:'Осень/Зима'},
                                     {id:'ANY',l:'Любой'}
                                  ].map(s => (
                                     <button 
                                        key={s.id} 
                                        onClick={() => setSelectedSeason(s.id as Season)} 
                                        className={`flex flex-col items-center justify-center p-3 text-sm border rounded-lg transition-all ${selectedSeason === s.id ? 'bg-amber-900/20 border-amber-600 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}
                                     >
                                        <span className="text-xs font-medium">{s.l}</span>
                                     </button>
                                  ))}
                               </div>
                            </div>
                            <div>
                               <label className="text-xs text-amber-600 font-bold uppercase tracking-widest block mb-3">
                                  СОБЫТИЕ
                               </label>
                               <div className="grid grid-cols-2 gap-2">
                                  {[
                                     {id:'CASUAL',l:'Повседневный', d:'Прогулки, встречи'},
                                     {id:'BUSINESS',l:'Офис / Работа', d:'Деловой стиль'},
                                     {id:'EVENT',l:'Вечер', d:'Праздничный выход'},
                                     {id:'SPORT',l:'Спорт', d:'Активный образ'}
                                  ].map(o => (
                                     <button 
                                        key={o.id} 
                                        onClick={() => setSelectedOccasion(o.id as Occasion)} 
                                        className={`text-left p-3 border rounded-lg transition-all ${selectedOccasion === o.id ? 'bg-neutral-800 border-amber-600 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}
                                     >
                                        <div className="font-medium text-sm">{o.l}</div>
                                        <div className="text-[10px] opacity-60">{o.d}</div>
                                     </button>
                                  ))}
                               </div>
                            </div>
                            <button onClick={() => setSetupStep(2)} className="w-full bg-white text-black py-4 font-serif uppercase tracking-widest mt-4 hover:bg-neutral-200 transition-colors rounded">Далее</button>
                         </div>
                      </div>
                    ) : (
                      <div className="animate-fade-in">
                         <div className="flex items-center gap-4 mb-6">
                           <button onClick={() => setSetupStep(1)} className="p-2 -ml-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-white">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                           </button>
                           <h2 className="text-2xl font-serif text-white">Где искать вещи?</h2>
                         </div>

                         <div className="space-y-6">
                            {/* Restored Store Logo Grid */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                               {stores.map(store => (
                                  <div 
                                    key={store.id}
                                    onClick={() => toggleStore(store.id)}
                                    className={`
                                      flex items-center justify-between p-3 border rounded-lg transition-all duration-300 cursor-pointer group
                                      ${store.isSelected 
                                        ? 'bg-neutral-800 border-amber-600/50 shadow-md' 
                                        : 'bg-neutral-900 border-neutral-800 opacity-60 hover:opacity-100 hover:border-neutral-700'}
                                    `}
                                  >
                                     <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 rounded bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-neutral-200">
                                           <img src={store.logoUrl} alt={store.name} className="w-full h-full object-contain" />
                                        </div>
                                        <span className={`text-sm font-medium truncate ${store.isSelected ? 'text-white' : 'text-neutral-400'}`}>
                                           {store.name}
                                        </span>
                                     </div>
                                     <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${store.isSelected ? 'bg-amber-600 border-amber-600' : 'border-neutral-600'}`}>
                                        {store.isSelected && <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                     </div>
                                  </div>
                               ))}
                            </div>

                            <div className="pt-4 border-t border-neutral-800">
                               <label className="text-xs text-amber-600 font-bold uppercase tracking-widest block mb-3">АНАЛИЗ</label>
                               <div className="grid grid-cols-2 gap-3 mb-4">
                                  <button onClick={() => handleModeChange('STANDARD')} className={`p-3 border rounded text-xs uppercase tracking-wider transition-all ${analysisMode === 'STANDARD' ? 'border-amber-600 bg-amber-900/10 text-white' : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}>
                                     СТАНДАРТНЫЙ
                                  </button>
                                  <button onClick={() => handleModeChange('OBJECTIVE')} className={`p-3 border rounded text-xs uppercase tracking-wider transition-all ${analysisMode === 'OBJECTIVE' ? 'border-amber-600 bg-amber-900/10 text-white' : 'border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}>
                                     ОБЪЕКТИВНЫЙ
                                  </button>
                               </div>
                               
                               {showObjectiveWarning && (
                                  <div className="bg-amber-900/20 border border-amber-700/30 p-3 rounded mb-4 animate-fade-in">
                                     <p className="text-[11px] text-amber-200/80 leading-relaxed">
                                        ⚠️ <strong>Внимание:</strong> Объективный режим может быть довольно прямолинейным. 
                                        ИИ укажет на особенности внешности честно.
                                     </p>
                                  </div>
                               )}
                            </div>
                            
                            <button onClick={startFlow} className="w-full bg-white text-black py-4 font-serif uppercase tracking-widest hover:bg-amber-500 transition-colors shadow-lg rounded">Создать Стиль</button>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {/* Loading State */}
        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-6">
            <div className="w-16 h-16 border-t-2 border-amber-500 rounded-full animate-spin"></div>
            <p className="text-white font-serif animate-pulse">{processingMessage}</p>
          </div>
        )}

        {/* RESULTS: Split View for Desktop, Tabs for Mobile */}
        {appState === AppState.RESULTS && analysis && (
          <div className="h-full animate-fade-in-up">
            {/* Mobile Tab Content */}
            <div className="md:grid md:grid-cols-12 md:gap-8">
               
               {/* Left/Main Column: Image Studio */}
               <div className={`md:col-span-5 ${activeMobileTab === 'STUDIO' ? 'block' : 'hidden md:block'}`}>
                  
                  {/* Image Container */}
                  <div className="relative bg-black aspect-[3/4] border border-neutral-800 overflow-hidden group rounded-lg">
                     {currentImage && currentImage !== originalImage ? (
                        <BeforeAfterSlider beforeImage={originalImage!} afterImage={currentImage} />
                     ) : (
                        currentImage && <img src={currentImage} className="w-full h-full object-cover" alt="Studio" />
                     )}
                     
                     {isProcessing && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center">
                           <div className="animate-spin w-8 h-8 border-t-2 border-white rounded-full mb-3"></div>
                           <span className="text-xs text-white tracking-widest uppercase">{processingMessage}</span>
                        </div>
                     )}
                  </div>

                  {/* Restored Simple Editor Controls */}
                  <div className="bg-neutral-900 border border-neutral-800 border-t-0 p-5 rounded-b-lg mb-4">
                     <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] text-amber-600 font-bold uppercase tracking-widest">AI Редактор</span>
                        {currentImage !== originalImage && !isProcessing && (
                           <button onClick={() => {setCurrentImage(originalImage); setEditPrompt('');}} className="text-xs text-neutral-500 hover:text-white underline decoration-dotted">
                              Сбросить
                           </button>
                        )}
                     </div>
                     <form onSubmit={handleEdit} className="relative">
                        <input 
                           type="text" 
                           value={editPrompt}
                           onChange={e => setEditPrompt(e.target.value)}
                           placeholder="Что изменить? (например: надень шляпу)"
                           disabled={isProcessing}
                           className="w-full bg-black border border-neutral-700 rounded py-3 pl-3 pr-10 text-sm text-white focus:border-amber-500 focus:outline-none placeholder-neutral-600 transition-colors"
                        />
                        <button type="submit" disabled={isProcessing || !editPrompt} className="absolute right-2 top-2 p-1 text-amber-500 disabled:opacity-30 hover:text-amber-400 transition-colors">
                           <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        </button>
                     </form>
                  </div>

                  {/* Analysis Info */}
                  <div className="p-5 border border-neutral-800 bg-neutral-900/30 rounded-lg">
                     <h3 className="text-xs font-bold text-neutral-500 uppercase tracking-widest mb-3">Детали Анализа</h3>
                     <p className="text-sm text-neutral-300 font-light leading-relaxed mb-4">{analysis.detailedDescription}</p>
                     
                     <div className="grid grid-cols-2 gap-4 border-t border-neutral-800 pt-3">
                        <div>
                           <span className="text-[10px] text-neutral-600 uppercase block mb-1">Тип фигуры</span>
                           <span className="text-sm text-white">{analysis.bodyType}</span>
                        </div>
                        <div>
                           <span className="text-[10px] text-neutral-600 uppercase block mb-1">Цветотип</span>
                           <span className="text-sm text-white">{analysis.seasonalColor}</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* Right/Second Column: Collection */}
               <div className={`md:col-span-7 pb-20 md:pb-0 ${activeMobileTab === 'COLLECTION' ? 'block' : 'hidden md:block'}`}>
                  <div className="mb-6 flex justify-between items-end">
                     <div>
                        <span className="text-amber-500 text-xs font-bold uppercase tracking-widest">Коллекция</span>
                        <h2 className="text-2xl md:text-3xl font-serif text-white">Рекомендации</h2>
                     </div>
                     <div className="hidden md:block">
                        <span className="text-xs text-neutral-500">
                           {recommendations.length} образов подобрано
                        </span>
                     </div>
                  </div>
                  
                  {recommendations.length > 0 ? (
                     <div className="grid grid-cols-1 gap-6">
                        {recommendations.map(style => (
                           <StyleCard 
                              key={style.id} 
                              style={style} 
                              isSelected={selectedStyleId === style.id}
                              onClick={() => setSelectedStyleId(style.id)}
                              onApplyStyle={() => handleApplyStyle(style)}
                              isGenerating={isProcessing && selectedStyleId === style.id}
                              stores={stores}
                              isProcessingGlobal={isProcessing}
                           />
                        ))}
                     </div>
                  ) : (
                     <div className="p-8 text-center border border-neutral-800 rounded bg-neutral-900/50">
                        <p className="text-neutral-500">Нет рекомендаций для отображения.</p>
                     </div>
                  )}
               </div>

            </div>
          </div>
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      {appState === AppState.RESULTS && (
         <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-neutral-800 flex md:hidden z-50 pb-safe">
            <button 
               onClick={() => setActiveMobileTab('STUDIO')}
               className={`flex-1 py-4 flex flex-col items-center justify-center gap-1 ${activeMobileTab === 'STUDIO' ? 'text-amber-500' : 'text-neutral-500'}`}
            >
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
               <span className="text-[10px] uppercase font-bold tracking-wider">Студия</span>
            </button>
            <div className="w-px bg-neutral-800 h-full"></div>
            <button 
               onClick={() => setActiveMobileTab('COLLECTION')}
               className={`flex-1 py-4 flex flex-col items-center justify-center gap-1 ${activeMobileTab === 'COLLECTION' ? 'text-amber-500' : 'text-neutral-500'}`}
            >
               <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
               <span className="text-[10px] uppercase font-bold tracking-wider">Коллекция</span>
            </button>
         </div>
      )}
    </div>
  );
};

export default App;
