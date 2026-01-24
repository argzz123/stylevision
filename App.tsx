
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { analyzeUserImage, getStyleRecommendations, editUserImage, compressImage, tryOnWardrobeItems, IS_DEMO_MODE } from './services/geminiService';
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

// --- REFINED ICONS ---

const IconStudio = ({ className, filled }: { className?: string, filled?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2L12 4M12 20L12 22M4 12L2 12M22 12L20 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M19.07 4.93L17.66 6.34M6.34 17.66L4.93 19.07M19.07 19.07L17.66 17.66M6.34 6.34L4.93 4.93" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        {/* Hanger Shape */}
        <path d="M12 7C12 7 7 10 7 13C7 15 9 17 12 17C15 17 17 15 17 13C17 10 12 7 12 7Z" stroke="currentColor" strokeWidth="1.5" fill={filled ? "currentColor" : "none"} />
        <path d="M12 7V5C12 5 12 4 13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

const IconWardrobe = ({ className, filled }: { className?: string, filled?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Cabinet Frame */}
        <rect x="4" y="3" width="16" height="18" rx="1" stroke="currentColor" strokeWidth="1.5" />
        {/* Center Line */}
        <path d="M12 3V21" stroke="currentColor" strokeWidth="1.5" />
        {/* Handles */}
        <circle cx="10" cy="12" r="1" fill={filled ? "currentColor" : "currentColor"} />
        <circle cx="14" cy="12" r="1" fill={filled ? "currentColor" : "currentColor"} />
        {/* Legs */}
        <path d="M5 21V23M19 21V23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

const IconProfile = ({ className, filled }: { className?: string, filled?: boolean }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill={filled ? "currentColor" : "none"} />
        <path d="M4 20C4 16 8 15 12 15C16 15 20 16 20 20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
);

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
  const [setupStep, setSetupStep] = useState<number>(0); // 0: Choice, 1: AI Setup, 2: Stores/Config, 3: Wardrobe Select
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
  const [selectedWardrobeItems, setSelectedWardrobeItems] = useState<string[]>([]);
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
     setSetupStep(0); 
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
        setSetupStep(0); // Reset to Choice Screen
        setAnalysisMode('STANDARD');
        setSelectedWardrobeItems([]);
      };
      reader.readAsDataURL(file);
    }
  };

  // Wardrobe Image Upload with Compression
  const handleWardrobeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && user) {
          triggerHaptic('light');
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64 = reader.result as string;
              // Compress to avoid lag and save space
              const compressedBase64 = await compressImage(base64, 800, 0.75);

              // Default category TOP, can be changed later or via prompt
              const newItem: WardrobeItem = {
                  id: Date.now().toString(),
                  imageUrl: compressedBase64,
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

  // New Function: Handle "Try On Wardrobe"
  const handleWardrobeTryOn = async () => {
      if (!originalImage || selectedWardrobeItems.length === 0) return;
      if (user?.isGuest) {
          triggerHaptic('warning');
          setShowGuestLockModal(true);
          return;
      }
      const canProceed = await checkLimit();
      if (!canProceed) return;

      try {
          triggerHaptic('medium');
          setAppState(AppState.ANALYZING); // Use loading screen
          setIsProcessing(true);
          setProcessingMessage('Примеряем выбранные вещи...');

          // Get full base64 for selected items from wardrobe state
          const itemsToTry = wardrobe
              .filter(item => selectedWardrobeItems.includes(item.id))
              .map(item => item.imageUrl);

          // Use the new geminiService function
          const newImage = await tryOnWardrobeItems(
              originalImage,
              itemsToTry,
              (msg) => setProcessingMessage(msg)
          );

          setCurrentImage(newImage);
          
          // Fake analysis object for consistency in Results view
          if (!analysis) {
             setAnalysis({
                 gender: 'Ваш стиль',
                 bodyType: 'Персональный',
                 seasonalColor: 'Гардероб',
                 styleKeywords: ['Мой Гардероб', 'Примерка'],
                 detailedDescription: 'Виртуальная примерка вещей из вашего гардероба.'
             });
          }
          setRecommendations([]); // No recommendations for this flow
          
          setAppState(AppState.RESULTS);
          saveToHistory(newImage, "Мой Гардероб (Примерка)");
          triggerHaptic('success');

      } catch (error: any) {
          console.error(error);
          triggerHaptic('error');
          alert(error.message);
          setAppState(AppState.PREVIEW); // Go back
      } finally {
          setIsProcessing(false);
      }
  };

  const toggleWardrobeSelection = (id: string) => {
      triggerHaptic('selection');
      setSelectedWardrobeItems(prev => {
          if (prev.includes(id)) return prev.filter(i => i !== id);
          if (prev.length >= 10) {
              alert("Можно выбрать максимум 10 вещей");
              return prev;
          }
          return [...prev, id];
      });
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
    setSetupStep(0);
    setOriginalImage(null);
    setCurrentImage(null);
    setAnalysis(null);
    setRecommendations([]);
    setSelectedWardrobeItems([]);
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

                 {/* Right: Setup Flow */}
                 <div className="space-y-6">
                    {/* Back Button (Appears if not in Choice mode or if Choice mode with no selections? Logic below) */}
                    <div className="flex items-center gap-4 mb-4">
                         <button 
                            onClick={() => {
                                triggerHaptic('light');
                                if (setupStep === 0) setAppState(AppState.UPLOAD); // Back to Upload
                                else if (setupStep === 3) setSetupStep(0); // Back from Wardrobe Select to Choice
                                else setSetupStep(0); // Back from AI Setup to Choice
                            }} 
                            className="p-2 -ml-2 hover:bg-neutral-800 rounded-full text-neutral-500 hover:text-white flex items-center gap-2"
                         >
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                             <span className="text-xs font-bold uppercase tracking-wide">Назад</span>
                         </button>
                    </div>

                    {/* Step 0: CHOICE SCREEN */}
                    {setupStep === 0 && (
                        <div className="animate-fade-in space-y-4">
                            <h2 className="text-2xl font-serif text-white mb-2">Что будем делать?</h2>
                            <p className="text-neutral-500 text-sm mb-6">Выберите режим работы стилиста</p>

                            <button 
                                onClick={() => { triggerHaptic('selection'); setSetupStep(1); }}
                                className="w-full bg-neutral-900 border border-neutral-800 p-6 rounded-xl hover:border-amber-600/50 transition-all group text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <IconStudio className="w-24 h-24 text-amber-500" />
                                </div>
                                <h3 className="text-xl font-serif text-white mb-2 group-hover:text-amber-500 transition-colors">AI Стилист</h3>
                                <p className="text-sm text-neutral-400 max-w-[80%]">
                                    ИИ проанализирует вашу внешность и предложит новые стильные образы из магазинов.
                                </p>
                            </button>

                            <button 
                                onClick={() => { triggerHaptic('selection'); setSetupStep(3); }}
                                className="w-full bg-neutral-900 border border-neutral-800 p-6 rounded-xl hover:border-amber-600/50 transition-all group text-left relative overflow-hidden"
                            >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                                    <IconWardrobe className="w-24 h-24 text-amber-500" />
                                </div>
                                <h3 className="text-xl font-serif text-white mb-2 group-hover:text-amber-500 transition-colors">Примерить свой гардероб</h3>
                                <p className="text-sm text-neutral-400 max-w-[80%]">
                                    Выберите вещи из своего виртуального гардероба, и ИИ наденет их на вас.
                                </p>
                            </button>
                        </div>
                    )}

                    {/* Step 3: WARDROBE SELECTION (New Flow) */}
                    {setupStep === 3 && (
                        <div className="animate-fade-in">
                            <h2 className="text-2xl font-serif text-white mb-2">Выберите вещи</h2>
                            <p className="text-neutral-500 text-sm mb-4">Отметьте до 10 вещей для примерки (выбрано: {selectedWardrobeItems.length})</p>
                            
                            {wardrobe.length === 0 ? (
                                <div className="text-center py-12 border border-dashed border-neutral-800 rounded-xl bg-neutral-900/30">
                                    <p className="text-neutral-400 text-sm mb-4">Ваш гардероб пуст</p>
                                    <button 
                                        onClick={() => setActiveTab('WARDROBE')}
                                        className="text-amber-500 border border-amber-900/30 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider hover:bg-amber-900/10"
                                    >
                                        Перейти в гардероб
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-3 gap-2 max-h-[400px] overflow-y-auto pr-2 mb-6 scrollbar-hide">
                                    {wardrobe.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => toggleWardrobeSelection(item.id)}
                                            className={`
                                                relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 transition-all
                                                ${selectedWardrobeItems.includes(item.id) ? 'border-amber-500 opacity-100' : 'border-transparent border-neutral-800 opacity-60 hover:opacity-100'}
                                            `}
                                        >
                                            <img src={item.imageUrl} className="w-full h-full object-cover" alt="Item" />
                                            {selectedWardrobeItems.includes(item.id) && (
                                                <div className="absolute top-1 right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                                                    <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}

                            <button 
                                onClick={handleWardrobeTryOn}
                                disabled={selectedWardrobeItems.length === 0}
                                className="w-full bg-white text-black py-4 font-serif uppercase tracking-widest mt-4 hover:bg-amber-500 transition-colors rounded disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Примерить
                            </button>
                        </div>
                    )}

                    {/* Step 1: AI SETUP (Context) */}
                    {setupStep === 1 && (
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
                    )}

                    {/* Step 2: STORES & CONFIG (AI Flow) */}
                    {setupStep === 2 && (
                      <div className="animate-fade-in">
                         <div className="flex items-center gap-4 mb-6">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start relative">
                  
                  {/* Home/Reset Button - Positioned absolutely on mobile or inline on desktop */}
                  <button 
                    onClick={resetApp}
                    className="absolute top-0 right-0 z-50 p-2 bg-neutral-800/80 backdrop-blur-md rounded-full text-white hover:bg-neutral-700 border border-neutral-700 transition-all md:hidden"
                  >
                     <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>

                  {/* Left Column: Image Area & Analysis */}
                  <div className="space-y-6">
                      <div className="flex items-center justify-between md:hidden">
                          <h2 className="text-xl font-serif text-white">Результат</h2>
                      </div>

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
                              <h3 className="text-lg font-serif text-white mb-3">Результаты</h3>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 border border-neutral-700">{analysis.gender}</span>
                                  <span className="px-3 py-1 rounded-full bg-neutral-800 text-xs text-neutral-300 border border-neutral-700">{analysis.bodyType}</span>
                              </div>
                              <p className="text-sm text-neutral-400 leading-relaxed mb-4">{analysis.detailedDescription}</p>
                          </div>
                      )}
                  </div>

                  {/* Right Column: Recommendations */}
                  <div className="space-y-6">
                       {/* Desktop Header with Reset */}
                       <div className="hidden md:flex items-center justify-between mb-4">
                           <h3 className="font-serif text-2xl text-white">
                               {recommendations.length > 0 ? "Рекомендации" : "Примерка Гардероба"}
                           </h3>
                           <button 
                                onClick={resetApp}
                                className="px-4 py-2 border border-neutral-700 rounded-lg hover:bg-neutral-800 text-sm transition-colors text-neutral-400 hover:text-white"
                           >
                                На главную
                           </button>
                       </div>

                       {recommendations.length > 0 ? (
                           <>
                               <div className="flex items-center justify-between md:hidden">
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
                               </div>
                           </>
                       ) : (
                           <div className="text-center py-20 border border-neutral-800 rounded-xl bg-neutral-900/30 flex flex-col items-center">
                                <IconWardrobe className="w-16 h-16 text-neutral-700 mb-4" />
                                <h3 className="text-lg font-serif text-neutral-400 mb-2">Режим примерки гардероба</h3>
                                <p className="text-sm text-neutral-600 max-w-xs">
                                    В этом режиме мы не генерируем новые рекомендации, а работаем с вашими вещами. Используйте редактор слева для доработки образа.
                                </p>
                           </div>
                       )}
                  </div>
              </div>
           </div>
        )}
    </div>
  );
};

export default App;
