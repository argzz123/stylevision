
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeUserImage, getStyleRecommendations, editUserImage, IS_DEMO_MODE } from './services/geminiService';
import { createPayment, PaymentResponse, checkPaymentStatus } from './services/paymentService';
import { storageService, GlobalConfig } from './services/storageService'; 
import { AppState, UserAnalysis, StyleRecommendation, AnalysisMode, Store, Season, Occasion, HistoryItem, MobileTab, TelegramUser, WardrobeItem, WardrobeCategory, UserProfilePreferences } from './types';
import StyleCard from './components/StyleCard';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import LoginScreen from './components/LoginScreen';
import LoadingScreen from './components/LoadingScreen'; 
import AdminPanel from './components/AdminPanel';
import ImageEditor from './components/ImageEditor';
import { triggerHaptic } from './utils/haptics'; 

// ADMIN ID CONSTANT (Array)
const ADMIN_IDS = [643780299, 1613288376];
const MODERATOR_ID = 999999; 

const FREE_LIMIT = 2; 

// SUBSCRIPTION PLANS CONFIGURATION
interface SubscriptionPlan {
  id: string;
  months: number;
  price: number;
  label: string;
  description: string;
  isBestValue?: boolean;
}

const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { 
    id: 'month_1', 
    months: 1, 
    price: 490, 
    label: '1 Месяц', 
    description: 'Старт' 
  },
  { 
    id: 'month_3', 
    months: 3, 
    price: 650, 
    label: '3 Месяца', 
    description: 'Выгодно' 
  },
  { 
    id: 'month_6', 
    months: 6, 
    price: 850, 
    label: '6 Месяцев', 
    description: 'Максимум',
    isBestValue: true
  }
];

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
  // Navigation State
  const [activeTab, setActiveTab] = useState<MobileTab>('STUDIO');

  // Loading & Init State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const [loadingStatusText, setLoadingStatusText] = useState("Настраиваем AI стилиста...");

  // Auth State
  const [user, setUser] = useState<TelegramUser | null>(null);

  // App Flow State (Studio)
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [setupStep, setSetupStep] = useState<number>(1);
  const [isPro, setIsPro] = useState(false);
  
  // Config State
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({ 
      price: "490.00", 
      productTitle: "StyleVision AI+", 
      productDescription: "",
      maintenanceMode: false
  });
  
  // Overlays
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAuthRequest, setShowAuthRequest] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false); 
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showGuestLockModal, setShowGuestLockModal] = useState(false);
  
  // Payment Pending Logic
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan>(SUBSCRIPTION_PLANS[1]); // Default to 3 months
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const paymentPollInterval = useRef<any>(null);

  // Data State (Studio)
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<UserAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('');
  
  // Settings State (Studio)
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>('STANDARD');
  const [showObjectiveWarning, setShowObjectiveWarning] = useState(false);
  const [stores, setStores] = useState<Store[]>(INITIAL_STORES);
  const [selectedSeason, setSelectedSeason] = useState<Season>('ANY');
  const [selectedOccasion, setSelectedOccasion] = useState<Occasion>('CASUAL');

  // New Data States
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [wardrobe, setWardrobe] = useState<WardrobeItem[]>([]);
  const [userPreferences, setUserPreferences] = useState<UserProfilePreferences>({ taboos: '', favoriteStyles: '' });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const wardrobeInputRef = useRef<HTMLInputElement>(null);

  // Helper: Is Admin?
  const isAdmin = (id: number) => ADMIN_IDS.includes(id);

  // Helper: Download Image
  const downloadImage = async (dataUrl: string, filename: string) => {
    triggerHaptic('light');
    const tg = (window as any).Telegram?.WebApp;
    const isTelegram = !!tg?.initData;

    if (isTelegram) {
        if (dataUrl.startsWith('http')) {
             tg.openLink(dataUrl);
        } else {
             alert("Сохраните образ в гардероб, чтобы открыть полную версию.");
        }
        return;
    }

    try {
       if (dataUrl.startsWith('data:')) {
           const link = document.createElement('a');
           link.href = dataUrl;
           link.download = filename;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
       } else {
           const response = await fetch(dataUrl);
           const blob = await response.blob();
           const blobUrl = window.URL.createObjectURL(blob);
           const link = document.createElement('a');
           link.href = blobUrl;
           link.download = filename;
           document.body.appendChild(link);
           link.click();
           document.body.removeChild(link);
           window.URL.revokeObjectURL(blobUrl);
       }
    } catch (e) {
       console.error("Download failed:", e);
       window.open(dataUrl, '_blank');
    }
  };

  const handleDeleteHistoryItem = async (e: React.MouseEvent, itemId: string) => {
    e.stopPropagation();
    triggerHaptic('warning');
    if (!user) return;
    if (!window.confirm("Вы уверены, что хотите удалить этот образ?")) return;
    setHistory(prev => prev.filter(item => item.id !== itemId));
    triggerHaptic('success');
    await storageService.deleteHistoryItem(user.id, itemId);
  };

  const withRetry = async <T,>(fn: () => Promise<T>, attempts: number = 3, baseDelay: number = 1500): Promise<T> => {
      for (let i = 0; i < attempts; i++) {
          try {
              return await fn();
          } catch (error) {
              const isLastAttempt = i === attempts - 1;
              if (isLastAttempt) throw error;
              const attemptNum = i + 2; 
              setLoadingStatusText(`Слабая сеть. Повторное подключение (${attemptNum}/${attempts})...`);
              const delay = baseDelay + (i * 1000); 
              await new Promise(resolve => setTimeout(resolve, delay));
          }
      }
      throw new Error("Failed after retries");
  };

  useEffect(() => {
    const initApp = async () => {
        try {
            const progressInterval = setInterval(() => {
                setLoadingProgress(prev => Math.min(prev + (Math.random() * 2), 90));
            }, 100);

            const tg = (window as any).Telegram?.WebApp;
            if (tg) {
                tg.expand();
                if (tg.isVersionAtLeast && tg.isVersionAtLeast('6.1')) {
                    tg.setHeaderColor('#050505');
                    tg.setBackgroundColor('#050505');
                }
                tg.ready();
            }
            
            setLoadingStatusText("Настраиваем AI стилиста...");
            const config = await withRetry(() => storageService.getGlobalConfig());
            setGlobalConfig(config);
            setLoadingProgress(50);

            let currentUser: TelegramUser | null = null;
            if (tg && tg.initDataUnsafe?.user) {
                const tgUser = tg.initDataUnsafe.user;
                const dbUser = await withRetry(() => storageService.getUser(tgUser.id));
                currentUser = {
                    ...tgUser,
                    isGuest: false,
                    subscriptionExpiresAt: dbUser?.subscriptionExpiresAt
                };
                storageService.saveUser(currentUser!); 
            } else {
                const storedUser = localStorage.getItem('stylevision_current_user');
                if (storedUser) {
                    try {
                        const parsedUser = JSON.parse(storedUser);
                        const dbUser = await withRetry(() => storageService.getUser(parsedUser.id));
                        currentUser = { ...parsedUser, ...dbUser };
                        storageService.saveUser(currentUser!);
                    } catch (e) { console.warn("Invalid local user data"); }
                }
            }

            if (currentUser) {
                 setUser(currentUser);
                 localStorage.setItem('stylevision_current_user', JSON.stringify(currentUser));
                 await withRetry(() => loadUserData(currentUser!.id)); 
            }

            clearInterval(progressInterval);
            setLoadingProgress(100);
            setTimeout(() => { setIsLoading(false); }, 600);

        } catch (error: any) {
            console.error("Initialization Failed:", error);
            setInitError("Не удалось загрузить данные. Проверьте соединение.");
        }
    };

    initApp();
  }, []);

  const handleRetryInit = () => {
      triggerHaptic('medium');
      setInitError(null);
      setLoadingProgress(0);
      setLoadingStatusText("Настраиваем AI стилиста...");
      setIsLoading(true);
      window.location.reload();
  };

  const handleLogin = useCallback(async (userData: TelegramUser) => {
     triggerHaptic('success');
     setUser(userData);
     localStorage.setItem('stylevision_current_user', JSON.stringify(userData));
     await storageService.saveUser(userData);
     await loadUserData(userData.id);
  }, []);

  const handleUpgradeAccount = useCallback(async (upgradedUser: TelegramUser) => {
     setUser(upgradedUser);
     localStorage.setItem('stylevision_current_user', JSON.stringify(upgradedUser));
     await storageService.saveUser(upgradedUser); 
     setShowAuthRequest(false);
     setShowPaymentModal(true);
  }, []);

  useEffect(() => {
    if (!pendingPaymentId) {
        if (paymentPollInterval.current) clearInterval(paymentPollInterval.current);
        setIsPollingPayment(false);
        return;
    }
    setIsPollingPayment(true);
    paymentPollInterval.current = setInterval(async () => {
        try {
            const isPaid = await checkPaymentStatus(pendingPaymentId);
            if (isPaid) {
                await processSuccessfulPayment(pendingPaymentId);
            }
        } catch (e) { console.error("Poll failed", e); }
    }, 3000);
    return () => clearInterval(paymentPollInterval.current);
  }, [pendingPaymentId]);

  const processSuccessfulPayment = async (paymentId: string) => {
      if (!user) return;
      clearInterval(paymentPollInterval.current);
      triggerHaptic('success');
      
      const storedMonths = localStorage.getItem('pending_payment_months');
      const monthsToAdd = storedMonths ? parseInt(storedMonths, 10) : 1;

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (monthsToAdd * 30));
      const expiresIso = expiresAt.toISOString();

      await storageService.setProStatus(user.id, true, expiresIso);
      
      const updatedUser = { ...user, subscriptionExpiresAt: expiresIso };
      setUser(updatedUser);
      localStorage.setItem('stylevision_current_user', JSON.stringify(updatedUser));
      
      setPendingPaymentId(null);
      localStorage.removeItem('pending_payment_id');
      localStorage.removeItem('pending_payment_months');
      
      setShowPaymentModal(false);
      setIsPro(true);
      alert(`Оплата прошла успешно! AI+ активирован на ${monthsToAdd} мес.`);
  };

  const loadUserData = async (userId: number) => {
    try {
        const [savedHistory, proStatus, savedWardrobe, savedPrefs] = await Promise.all([
            storageService.getHistory(userId),
            storageService.getProStatus(userId),
            storageService.getWardrobe(userId),
            storageService.getPreferences(userId)
        ]);
        
        setHistory(savedHistory);
        setWardrobe(savedWardrobe);
        setUserPreferences(savedPrefs);

        const storedPendingId = localStorage.getItem('pending_payment_id');
        if (storedPendingId) {
            setPendingPaymentId(storedPendingId);
            const isPaid = await checkPaymentStatus(storedPendingId);
            if (isPaid) {
                processSuccessfulPayment(storedPendingId);
            }
        } else {
            setIsPro(proStatus);
        }
    } catch (e) {
        console.error("Failed to load user extra data", e);
    }
  };

  const checkLimit = async (): Promise<boolean> => {
     if (!user) return false;
     if (isPro) return true;
     const count = await storageService.getRecentGenerationsCount(user.id, 5); 
     if (count >= FREE_LIMIT) {
         triggerHaptic('warning');
         setShowLimitModal(true);
         return false;
     }
     return true;
  };

  const saveToHistory = async (img: string, styleName: string) => {
    if (!originalImage || !analysis || !user) return;
    try {
        const newItem: HistoryItem = {
          id: Date.now().toString(),
          date: new Date().toLocaleDateString('ru-RU'),
          originalImage: originalImage,
          resultImage: img,
          styleTitle: styleName,
          analysis: analysis, 
          recommendations: recommendations
        };
        setHistory(prev => [newItem, ...prev].slice(0, 20));
        await storageService.saveHistoryItem(user.id, newItem);
    } catch (err) { console.error("Error saving history:", err); }
  };

  const loadFromHistory = (item: HistoryItem) => {
     triggerHaptic('selection');
     setOriginalImage(item.originalImage);
     setCurrentImage(item.resultImage);
     setAppState(AppState.RESULTS);
     setActiveTab('STUDIO'); // Switch to Studio tab
     setSetupStep(1); 
     if (item.analysis) setAnalysis(item.analysis);
     if (item.recommendations) {
        setRecommendations(item.recommendations);
        if (item.recommendations.length > 0) setSelectedStyleId(item.recommendations[0].id);
     }
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [appState, setupStep, activeTab]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      triggerHaptic('light');
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

  // Wardrobe Image Upload
  const handleWardrobeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && user) {
          triggerHaptic('light');
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              // Default category TOP, can be changed later or via prompt
              const newItem: WardrobeItem = {
                  id: Date.now().toString(),
                  imageUrl: base64,
                  category: 'TOP',
                  createdAt: new Date().toISOString()
              };
              setWardrobe(prev => [newItem, ...prev]);
              await storageService.saveWardrobeItem(user.id, newItem);
          };
          reader.readAsDataURL(file);
      }
  };
  
  const handleDeleteWardrobeItem = async (e: React.MouseEvent, itemId: string) => {
      e.stopPropagation();
      if (!user) return;
      if (!window.confirm("Удалить вещь?")) return;
      setWardrobe(prev => prev.filter(i => i.id !== itemId));
      await storageService.deleteWardrobeItem(user.id, itemId);
  };

  const handleModeChange = (mode: AnalysisMode) => {
    triggerHaptic('light');
    setAnalysisMode(mode);
    setShowObjectiveWarning(mode === 'OBJECTIVE');
  };

  const toggleStore = (storeId: string) => {
    triggerHaptic('selection');
    setStores(prev => prev.map(store => 
      store.id === storeId ? { ...store, isSelected: !store.isSelected } : store
    ));
  };

  const handleBuyProClick = () => {
      triggerHaptic('light');
      if (user?.isGuest) {
          setShowAuthRequest(true);
          return;
      }
      setShowPaymentModal(true);
      setShowLimitModal(false);
  };

  const initiatePayment = async (plan: SubscriptionPlan) => {
    triggerHaptic('medium');
    if (!user) return;
    if (user.isGuest) {
        setShowPaymentModal(false);
        setShowAuthRequest(true);
        return;
    }
    try {
        setIsProcessing(true);
        setProcessingMessage('Соединение с ЮKassa...');
        const description = `Подписка StyleVision AI+ (${plan.label})`;
        const payment = await createPayment(plan.price.toFixed(2), description);
        if (payment.confirmation && payment.confirmation.confirmation_url) {
            const paymentUrl = payment.confirmation.confirmation_url;
            if (payment.id) {
                localStorage.setItem('pending_payment_id', payment.id);
                localStorage.setItem('pending_payment_months', String(plan.months));
                setPendingPaymentId(payment.id);
            }
            const tg = (window as any).Telegram?.WebApp;
            if (tg?.initData) {
                tg.openLink(paymentUrl, { try_instant_view: false });
            } else {
                window.location.href = paymentUrl;
            }
        } else { throw new Error("Не получена ссылка на оплату"); }
    } catch (e: any) {
        console.error(e);
        triggerHaptic('error');
        alert(`Ошибка оплаты: ${e.message}.`);
        setPendingPaymentId(null);
    } finally { setIsProcessing(false); }
  };

  const performAnalysis = async () => {
     if (user?.isGuest) {
         triggerHaptic('warning');
         setShowGuestLockModal(true);
         return;
     }
     try {
      triggerHaptic('medium');
      setAppState(AppState.ANALYZING);
      setIsProcessing(true);
      setProcessingMessage('Анализируем ваш профиль...');
      const analysisResult = await analyzeUserImage(
          originalImage!, 
          analysisMode,
          (msg) => setProcessingMessage(msg)
      );
      setAnalysis(analysisResult);
      triggerHaptic('success');
      setProcessingMessage(`Ищем образы (${selectedSeason === 'ANY' ? 'база' : selectedSeason})...`);
      const styles = await getStyleRecommendations(
          analysisResult, 
          stores, 
          { season: selectedSeason, occasion: selectedOccasion },
          (msg) => setProcessingMessage(msg),
          userPreferences // Passing new preferences
      );
      setRecommendations(styles);
      if (styles.length > 0) setSelectedStyleId(styles[0].id);
      setAppState(AppState.RESULTS);
      triggerHaptic('success');
    } catch (error: any) {
      console.error(error);
      triggerHaptic('error');
      alert(error.message);
      setAppState(AppState.UPLOAD);
    } finally { setIsProcessing(false); }
  }

  const startFlow = () => performAnalysis();

  const handleApplyStyle = async (style: StyleRecommendation) => {
    if (!originalImage || !analysis) return;
    if (user?.isGuest) {
        triggerHaptic('warning');
        setShowGuestLockModal(true);
        return;
    }
    const canProceed = await checkLimit();
    if (!canProceed) return;
    try {
      triggerHaptic('medium');
      setIsProcessing(true);
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
      const newImage = await editUserImage(
          originalImage, 
          prompt, 
          undefined,
          (msg) => setProcessingMessage(msg)
      );
      setCurrentImage(newImage);
      saveToHistory(newImage, safeTitle);
      triggerHaptic('success');
    } catch (error: any) {
      console.error(error);
      triggerHaptic('error');
      alert(error.message);
    } finally { setIsProcessing(false); }
  };

  const handleEdit = async (prompt: string, mask?: string) => {
     if (!currentImage || !prompt.trim()) return;
     if (user?.isGuest) {
         triggerHaptic('warning');
         setShowGuestLockModal(true);
         return;
     }
     const canProceed = await checkLimit();
     if (!canProceed) return;
     try {
        triggerHaptic('medium');
        setIsProcessing(true);
        setProcessingMessage('Редактируем фото...');
        const newImage = await editUserImage(
            currentImage, 
            prompt,
            mask,
            (msg) => setProcessingMessage(msg)
        );
        setCurrentImage(newImage);
        saveToHistory(newImage, "Edit: " + prompt);
        triggerHaptic('success');
     } catch (err: any) {
        console.error(err);
        triggerHaptic('error');
        alert(err.message);
     } finally { setIsProcessing(false); }
  }

  const resetApp = () => {
    triggerHaptic('light');
    setAppState(AppState.UPLOAD);
    setSetupStep(1);
    setOriginalImage(null);
    setCurrentImage(null);
    setAnalysis(null);
    setRecommendations([]);
  };

  const handleLogout = () => {
     triggerHaptic('medium');
     setUser(null);
     localStorage.removeItem('stylevision_current_user');
     setAppState(AppState.UPLOAD);
     setHistory([]);
     setActiveTab('STUDIO');
  };

  const handleGuestToLogin = () => {
      setShowGuestLockModal(false);
      handleLogout();
  };

  const savePreferences = async () => {
      if (!user) return;
      triggerHaptic('success');
      await storageService.savePreferences(user.id, userPreferences);
      alert('Настройки стиля сохранены!');
  };

  const cancelPendingPayment = () => {
      setPendingPaymentId(null);
      localStorage.removeItem('pending_payment_id');
      localStorage.removeItem('pending_payment_months');
      clearInterval(paymentPollInterval.current);
      setShowPaymentModal(false);
  }

  // --- RENDERING ---

  if (isLoading) {
      return (
          <LoadingScreen 
            progress={loadingProgress} 
            error={initError} 
            onRetry={handleRetryInit}
            message={loadingStatusText}
          />
      );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (globalConfig.maintenanceMode && !isAdmin(user.id) && user.id !== MODERATOR_ID) {
      return (
          <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="w-24 h-24 bg-yellow-900/20 border border-yellow-600/50 rounded-full flex items-center justify-center mb-8">
                  <svg className="w-12 h-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
              </div>
              <h1 className="text-3xl font-serif text-white mb-4">Мы обновляемся</h1>
              <p className="text-neutral-400 max-w-md mb-8 leading-relaxed">
                  В данный момент проводятся технические работы.
              </p>
          </div>
      );
  }

  // Navigation Logic
  const renderStudio = () => (
    <div className="animate-fade-in">
        {/* Upload State */}
        {appState === AppState.UPLOAD && (
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <div className="text-center max-w-3xl mx-auto mb-10 px-4">
              <span className="text-amber-500 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase mb-4 block">AI Stylist</span>
              <h2 className="text-4xl md:text-6xl font-serif mb-6 text-white leading-tight">
                Ваш Идеальный <br /><span className="italic text-neutral-400">Стиль</span>
              </h2>
              <p className="text-neutral-500 text-sm md:text-lg font-light max-w-xl mx-auto">
                 Загрузите фото для анализа внешности и подбора гардероба.
              </p>
            </div>

            <div onClick={() => { triggerHaptic('light'); fileInputRef.current?.click(); }} className="w-full max-w-md aspect-[3/2] border border-neutral-800 bg-neutral-900/30 hover:bg-neutral-900 transition-all cursor-pointer flex flex-col items-center justify-center">
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
                                        onClick={() => { triggerHaptic('light'); setSelectedSeason(s.id as Season); }} 
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
                                        onClick={() => { triggerHaptic('light'); setSelectedOccasion(o.id as Occasion); }} 
                                        className={`text-left p-3 border rounded-lg transition-all ${selectedOccasion === o.id ? 'bg-neutral-800 border-amber-600 text-white' : 'bg-neutral-900 border-neutral-800 text-neutral-500 hover:border-neutral-600'}`}
                                     >
                                        <div className="font-medium text-sm">{o.l}</div>
                                        <div className="text-[10px] opacity-60">{o.d}</div>
                                     </button>
                                  ))}
                               </div>
                            </div>
                            <button onClick={() => { triggerHaptic('light'); setSetupStep(2); }} className="w-full bg-white text-black py-4 font-serif uppercase tracking-widest mt-4 hover:bg-neutral-200 transition-colors rounded">Далее</button>
                         </div>
                      </div>
                    ) : (
                      <div className="animate-fade-in">
                         <div className="flex items-center gap-4 mb-6">
                           <button onClick={() => { triggerHaptic('light'); setSetupStep(1); }} className="p-2 -ml-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-white">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                           </button>
                           <h2 className="text-2xl font-serif text-white">Где искать вещи?</h2>
                         </div>

                         <div className="space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 scrollbar-hide">
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

        {/* Analyzing State */}
        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in text-center px-4">
             <div className="w-24 h-24 border-4 border-neutral-800 border-t-amber-600 rounded-full animate-spin mb-8"></div>
             <h2 className="text-2xl md:text-3xl font-serif text-white mb-4 animate-pulse">
               {processingMessage || 'Анализируем фото...'}
             </h2>
             <p className="text-neutral-500 max-w-md mx-auto leading-relaxed">
               Искусственный интеллект изучает особенности вашей внешности, чтобы подобрать идеальный стиль.
             </p>
          </div>
        )}

        {/* Results State */}
        {appState === AppState.RESULTS && (
           <div className="max-w-7xl mx-auto animate-fade-in pb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
                  {/* Left Column: Image Area & Analysis */}
                  <div className="space-y-6">
                      <div className="aspect-[3/4] relative rounded-xl overflow-hidden border border-neutral-800 bg-black">
                         {/* Main Image Display */}
                         {currentImage ? (
                            <div className="relative w-full h-full">
                               <BeforeAfterSlider 
                                  beforeImage={originalImage!} 
                                  afterImage={currentImage} 
                               />
                               {/* Actions overlay */}
                               <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                                  <button onClick={() => downloadImage(currentImage, `stylevision_${Date.now()}.png`)} className="bg-black/50 hover:bg-black/70 text-white p-2 rounded-full backdrop-blur transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  </button>
                               </div>
                            </div>
                         ) : (
                            <div className="animate-pulse bg-neutral-900 w-full h-full flex items-center justify-center">
                                <span className="text-neutral-700">Загрузка изображения...</span>
                            </div>
                         )}
                         
                         {/* Processing Overlay inside Image Area */}
                         {isProcessing && (
                             <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                                 <div className="w-16 h-16 border-4 border-amber-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                                 <p className="text-xl font-serif text-white mb-2">{processingMessage || 'Обработка...'}</p>
                                 <p className="text-sm text-neutral-400">Это может занять 10-20 секунд</p>
                             </div>
                         )}
                      </div>
                      
                      <ImageEditor 
                        originalImage={currentImage || originalImage!} 
                        onEdit={handleEdit} 
                        isProcessing={isProcessing} 
                     />

                      {/* Analysis Block */}
                      {analysis && (
                          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 mt-6 animate-fade-in">
                              <h3 className="text-lg font-serif text-white mb-3">Результаты Анализа</h3>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 border border-neutral-700">Пол: {analysis.gender}</span>
                                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 border border-neutral-700">Фигура: {analysis.bodyType}</span>
                                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 border border-neutral-700">Цветотип: {analysis.seasonalColor}</span>
                              </div>
                              <p className="text-sm text-neutral-400 leading-relaxed mb-4">{analysis.detailedDescription}</p>
                              <div className="flex flex-wrap gap-2">
                                  {analysis.styleKeywords.map((kw, i) => (
                                      <span key={i} className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">#{kw}</span>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Right Column: Recommendations */}
                  <div className="space-y-6">
                       <div className="flex items-center justify-between">
                           <h3 className="font-serif text-2xl text-white">Рекомендации</h3>
                           <span className="text-neutral-500 text-sm">{recommendations.length} образов</span>
                       </div>
                       
                       <div className="grid grid-cols-1 gap-6">
                           {recommendations.map(style => (
                              <StyleCard 
                                  key={style.id}
                                  style={style}
                                  isSelected={selectedStyleId === style.id}
                                  onClick={() => { triggerHaptic('selection'); setSelectedStyleId(style.id); }}
                                  onApplyStyle={() => handleApplyStyle(style)}
                                  isGenerating={isProcessing && processingMessage.includes(style.title)}
                                  isProcessingGlobal={isProcessing}
                                  stores={stores}
                               />
                           ))}
                           {recommendations.length === 0 && (
                                <div className="text-center text-neutral-500 py-10 border border-neutral-800 rounded-xl bg-neutral-900/30">
                                    <p>Нет рекомендаций. Попробуйте изменить параметры анализа или перезагрузить страницу.</p>
                                </div>
                           )}
                       </div>
                  </div>
              </div>
           </div>
        )}
    </div>
  );

  const renderWardrobe = () => (
      <div className="animate-fade-in p-2 pb-20">
          <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-serif text-white">Мой Гардероб</h2>
              <button 
                onClick={() => wardrobeInputRef.current?.click()}
                className="bg-amber-600 text-black px-4 py-2 rounded-full font-bold text-xs uppercase shadow-lg shadow-amber-900/20 flex items-center gap-2 hover:bg-amber-500 transition-colors"
              >
                 <span>+ Добавить вещь</span>
              </button>
              <input type="file" ref={wardrobeInputRef} className="hidden" accept="image/*" onChange={handleWardrobeUpload} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {wardrobe.map((item) => (
                  <div key={item.id} className="relative aspect-square border border-neutral-800 rounded-lg overflow-hidden group bg-neutral-900">
                      <img src={item.imageUrl} alt="Wardrobe Item" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-2">
                          <span className="text-[10px] text-neutral-400 uppercase tracking-wider mb-2 block">{item.category}</span>
                          <button 
                            onClick={(e) => handleDeleteWardrobeItem(e, item.id)}
                            className="w-full bg-red-900/50 text-red-400 text-xs py-1 rounded hover:bg-red-900"
                          >
                             Удалить
                          </button>
                      </div>
                  </div>
              ))}
              {wardrobe.length === 0 && (
                  <div className="col-span-2 md:col-span-4 lg:col-span-5 text-center py-12 border-2 border-dashed border-neutral-800 rounded-xl">
                      <p className="text-neutral-500 text-sm mb-2">Ваш гардероб пуст</p>
                      <p className="text-xs text-neutral-600">Загрузите фото своих вещей, чтобы ИИ мог их использовать</p>
                  </div>
              )}
          </div>
      </div>
  );

  const renderProfile = () => (
      <div className="animate-fade-in p-2 pb-20 max-w-4xl mx-auto space-y-8">
          {/* User Info Card */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex items-center gap-6">
               <div className="w-20 h-20 rounded-full bg-neutral-800 border-2 border-neutral-700 flex items-center justify-center overflow-hidden">
                    {user?.photo_url ? (
                        <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-3xl">👤</span>
                    )}
               </div>
               <div className="flex-1">
                   <h2 className="text-2xl font-serif text-white">{user?.first_name} {user?.last_name}</h2>
                   <p className="text-neutral-500 text-sm mb-3">@{user?.username}</p>
                   {isPro ? (
                       <span className="inline-block bg-green-900/30 text-green-500 border border-green-900 text-xs px-2 py-0.5 rounded">AI+ Активен</span>
                   ) : (
                       <button onClick={handleBuyProClick} className="text-amber-500 text-xs font-bold uppercase tracking-wider hover:underline">
                          Купить подписку
                       </button>
                   )}
               </div>
          </div>

          {/* Preferences Section */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6">
              <h3 className="text-lg font-serif text-white mb-4">Настройки Стиля (Предпочтения)</h3>
              <div className="space-y-4">
                  <div>
                      <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2">
                          Любимые стили (Что вам нравится)
                      </label>
                      <textarea 
                          value={userPreferences.favoriteStyles}
                          onChange={(e) => setUserPreferences({...userPreferences, favoriteStyles: e.target.value})}
                          placeholder="Например: Минимализм, Old Money, Яркие цвета..."
                          className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-sm text-white focus:border-amber-600 outline-none h-20"
                      />
                  </div>
                  <div>
                      <label className="block text-xs text-neutral-500 uppercase tracking-widest mb-2 text-red-400">
                          Табу (Чего избегать)
                      </label>
                      <textarea 
                          value={userPreferences.taboos}
                          onChange={(e) => setUserPreferences({...userPreferences, taboos: e.target.value})}
                          placeholder="Например: Не ношу каблуки, избегаю желтый цвет..."
                          className="w-full bg-black border border-neutral-800 rounded-lg p-3 text-sm text-white focus:border-red-900 outline-none h-20"
                      />
                  </div>
                  <button 
                    onClick={savePreferences}
                    className="bg-neutral-800 hover:bg-neutral-700 text-white px-6 py-2 rounded-lg text-sm transition-colors"
                  >
                     Сохранить настройки
                  </button>
              </div>
          </div>

          {/* Gallery (Old History) */}
          <div className="space-y-4">
              <h3 className="text-xl font-serif text-white">Галерея Образов</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {history.map((item) => (
                     <div key={item.id} onClick={() => loadFromHistory(item)} className="cursor-pointer group border border-neutral-800 hover:border-amber-600/50 bg-neutral-900 transition-all relative rounded-lg overflow-hidden">
                        <div className="aspect-[3/4] relative overflow-hidden group/image">
                           <img src={item.resultImage || item.originalImage} className="w-full h-full object-cover" alt="History" />
                           <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                               <button 
                                  onClick={(e) => {
                                     e.stopPropagation();
                                     downloadImage(item.resultImage || item.originalImage, `stylevision_${item.id}.png`);
                                  }}
                                  className="p-2 bg-black/60 text-white rounded-full hover:bg-amber-600"
                               >
                                  ⬇️
                               </button>
                               <button 
                                  onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                                  className="p-2 bg-black/60 text-white rounded-full hover:bg-red-600"
                               >
                                  🗑️
                               </button>
                           </div>
                        </div>
                        <div className="p-3">
                           <h4 className="font-serif text-sm text-white truncate">{item.styleTitle}</h4>
                           <p className="text-[10px] text-neutral-500">{item.date}</p>
                        </div>
                     </div>
                  ))}
                  {history.length === 0 && (
                      <div className="col-span-full text-center py-8 text-neutral-500 text-sm">История пуста</div>
                  )}
              </div>
          </div>
          
           {/* Admin & Logout */}
           <div className="flex justify-between items-center pt-8 border-t border-neutral-800">
               {isAdmin(user.id) && (
                  <button 
                    onClick={() => setShowAdminPanel(true)}
                    className="text-red-500 text-xs uppercase tracking-widest font-bold border border-red-900/30 px-3 py-1 rounded hover:bg-red-900/10"
                  >
                    Admin Panel
                  </button>
               )}
               <button onClick={handleLogout} className="text-neutral-500 hover:text-white text-xs uppercase tracking-widest">
                   Выйти
               </button>
           </div>
      </div>
  );

  return (
    <div className="min-h-screen bg-[#050505] text-neutral-300 font-sans flex relative overflow-hidden">
      
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 h-screen fixed left-0 top-0 bg-black border-r border-neutral-800 z-50 p-6">
          <div className="flex items-center gap-3 mb-12 cursor-pointer" onClick={resetApp}>
             <div className="w-8 h-8 border border-neutral-700 flex items-center justify-center bg-neutral-900">
               <span className="font-serif text-xl text-amber-500">S</span>
             </div>
             <h1 className="text-lg font-serif text-white tracking-widest">STYLEVISION</h1>
          </div>
          
          <nav className="flex-1 space-y-4">
              <button 
                onClick={() => setActiveTab('STUDIO')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'STUDIO' ? 'bg-amber-900/20 text-amber-500 border border-amber-900/50' : 'text-neutral-400 hover:bg-neutral-900'}`}
              >
                  <span>✨</span>
                  <span className="font-bold text-sm tracking-wide">Студия</span>
              </button>
              <button 
                onClick={() => setActiveTab('WARDROBE')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'WARDROBE' ? 'bg-amber-900/20 text-amber-500 border border-amber-900/50' : 'text-neutral-400 hover:bg-neutral-900'}`}
              >
                  <span>👗</span>
                  <span className="font-bold text-sm tracking-wide">Гардероб</span>
              </button>
              <button 
                onClick={() => setActiveTab('PROFILE')}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === 'PROFILE' ? 'bg-amber-900/20 text-amber-500 border border-amber-900/50' : 'text-neutral-400 hover:bg-neutral-900'}`}
              >
                  <span>👤</span>
                  <span className="font-bold text-sm tracking-wide">Профиль</span>
              </button>
          </nav>

          {!isPro && (
             <div className="bg-gradient-to-br from-amber-900/40 to-black border border-amber-700/30 p-4 rounded-xl mt-auto">
                 <h4 className="text-white font-bold text-sm mb-1">Go Pro</h4>
                 <p className="text-[10px] text-neutral-400 mb-3">Разблокируй все возможности</p>
                 <button onClick={handleBuyProClick} className="w-full bg-amber-600 text-black text-xs font-bold py-2 rounded">
                     Купить AI+
                 </button>
             </div>
          )}
      </aside>

      {/* MOBILE CONTENT AREA (With Bottom Padding) */}
      <main className="flex-1 md:ml-64 w-full relative h-screen overflow-y-auto">
          {/* Mobile Header */}
          <header className="md:hidden sticky top-0 z-40 bg-black/80 backdrop-blur border-b border-neutral-800 px-4 h-16 flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <div className="w-6 h-6 border border-neutral-700 flex items-center justify-center bg-neutral-900">
                   <span className="font-serif text-sm text-amber-500">S</span>
                 </div>
                 <span className="font-serif text-white tracking-widest text-sm">STYLEVISION</span>
              </div>
              {!isPro && <button onClick={handleBuyProClick} className="bg-amber-600 text-black text-[10px] font-bold px-3 py-1 rounded-full">AI+</button>}
          </header>

          <div className="p-4 md:p-8 pb-24 md:pb-8">
             {activeTab === 'STUDIO' && renderStudio()}
             {activeTab === 'WARDROBE' && renderWardrobe()}
             {activeTab === 'PROFILE' && renderProfile()}
          </div>
      </main>

      {/* MOBILE BOTTOM NAV */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black border-t border-neutral-800 h-16 grid grid-cols-3 pb-safe">
          <button 
            onClick={() => { triggerHaptic('selection'); setActiveTab('STUDIO'); }}
            className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'STUDIO' ? 'text-amber-500' : 'text-neutral-500'}`}
          >
              <span className="text-lg">✨</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Студия</span>
          </button>
          <button 
            onClick={() => { triggerHaptic('selection'); setActiveTab('WARDROBE'); }}
            className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'WARDROBE' ? 'text-amber-500' : 'text-neutral-500'}`}
          >
              <span className="text-lg">👗</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Гардероб</span>
          </button>
          <button 
            onClick={() => { triggerHaptic('selection'); setActiveTab('PROFILE'); }}
            className={`flex flex-col items-center justify-center gap-1 ${activeTab === 'PROFILE' ? 'text-amber-500' : 'text-neutral-500'}`}
          >
              <span className="text-lg">👤</span>
              <span className="text-[10px] font-bold uppercase tracking-wider">Профиль</span>
          </button>
      </nav>

      {/* OVERLAYS */}
      {showAdminPanel && isAdmin(user.id) && (
         <AdminPanel onClose={() => setShowAdminPanel(false)} currentUserId={user.id} />
      )}
      {showAuthRequest && (
          <LoginScreen onLogin={handleUpgradeAccount} isOverlay={true} onCancel={() => setShowAuthRequest(false)} />
      )}
      {showPaymentModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
             <div className="relative w-full max-w-lg bg-[#0a0a0a] border border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl my-auto">
                <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-400 to-amber-700 p-[1px]">
                        <div className="w-full h-full rounded-full bg-black flex items-center justify-center">
                            <span className="font-serif text-3xl text-amber-500 italic">S</span>
                        </div>
                    </div>
                    {!pendingPaymentId ? (
                        <>
                            <h2 className="text-2xl font-serif text-white mb-1">Выберите тариф</h2>
                            <p className="text-neutral-400 text-sm mb-6">Разблокируйте все возможности StyleVision AI+</p>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                {SUBSCRIPTION_PLANS.map(plan => (
                                    <div 
                                        key={plan.id}
                                        onClick={() => { triggerHaptic('selection'); setSelectedPlan(plan); }}
                                        className={`
                                            relative cursor-pointer p-4 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center
                                            ${selectedPlan.id === plan.id 
                                                ? 'bg-neutral-800 border-amber-500 shadow-lg shadow-amber-900/20 transform scale-105 z-10' 
                                                : 'bg-neutral-900/50 border-neutral-800 hover:bg-neutral-800 hover:border-neutral-700 opacity-80 hover:opacity-100'}
                                        `}
                                    >
                                        {plan.isBestValue && (
                                            <div className="absolute -top-2.5 bg-amber-600 text-black text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                                Best Value
                                            </div>
                                        )}
                                        <div className="text-sm text-neutral-400 mb-1 font-medium">{plan.label}</div>
                                        <div className={`text-xl font-bold mb-1 ${selectedPlan.id === plan.id ? 'text-white' : 'text-neutral-200'}`}>
                                            {plan.price} ₽
                                        </div>
                                        <div className="text-[10px] text-amber-600 font-medium uppercase tracking-wider">
                                            {plan.description}
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => initiatePayment(selectedPlan)}
                                disabled={isProcessing}
                                className="w-full bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-black border-t-transparent rounded-full"></div>
                                ) : (
                                    <><span>Оплатить {selectedPlan.price} ₽</span></>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            <h2 className="text-xl font-serif text-white mb-4">Ожидание оплаты...</h2>
                            <button onClick={cancelPendingPayment} className="text-xs text-neutral-500 hover:text-white border-b border-neutral-700 hover:border-white pb-0.5 transition-all">Отменить</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}
      {showGuestLockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-[#0a0a0a] border border-amber-900/50 rounded-2xl p-8 shadow-2xl overflow-hidden">
                <button onClick={() => setShowGuestLockModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">X</button>
                <div className="text-center">
                    <h2 className="text-2xl font-serif text-white mb-3">Только для авторизованных</h2>
                    <button onClick={handleGuestToLogin} className="w-full bg-white text-black font-bold py-3.5 rounded-xl">Войти через Telegram</button>
                </div>
            </div>
         </div>
      )}
      {showLimitModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-[#0a0a0a] border border-amber-900/50 rounded-2xl p-8 shadow-2xl overflow-hidden">
                <button onClick={() => setShowLimitModal(false)} className="absolute top-4 right-4 text-neutral-500 hover:text-white">X</button>
                <div className="text-center">
                    <h2 className="text-2xl font-serif text-white mb-3">Лимит исчерпан</h2>
                    <button onClick={handleBuyProClick} className="w-full bg-amber-600 text-black font-bold py-3.5 rounded-xl">Снять лимиты</button>
                </div>
            </div>
         </div>
      )}
    </div>
  );
};

export default App;
