
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { analyzeUserImage, getStyleRecommendations, editUserImage, IS_DEMO_MODE } from './services/geminiService';
import { createPayment, PaymentResponse, checkPaymentStatus } from './services/paymentService';
import { storageService, GlobalConfig } from './services/storageService'; 
import { AppState, UserAnalysis, StyleRecommendation, AnalysisMode, Store, Season, Occasion, HistoryItem, MobileTab, TelegramUser } from './types';
import StyleCard from './components/StyleCard';
import BeforeAfterSlider from './components/BeforeAfterSlider';
import LoginScreen from './components/LoginScreen';
import LoadingScreen from './components/LoadingScreen'; 
import AdminPanel from './components/AdminPanel';
import ImageEditor from './components/ImageEditor';
import { triggerHaptic } from './utils/haptics'; 
import { generateStoryImage } from './utils/storyGenerator'; 

// ADMIN ID CONSTANT (Array)
const ADMIN_IDS = [643780299, 1613288376];
const MODERATOR_ID = 999999; 

// SUBSCRIPTION PLANS CONFIGURATION INTERFACE
interface SubscriptionPlan {
  id: string;
  months: number;
  price: number;
  label: string;
  description: string;
  isBestValue?: boolean;
}

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
  // Theme State
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
      const saved = localStorage.getItem('stylevision_theme');
      return (saved === 'dark' || saved === 'light') ? saved : 'dark';
  });

  // Apply theme class to html element
  useEffect(() => {
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      root.classList.add(theme);
      localStorage.setItem('stylevision_theme', theme);
      
      // Update Telegram WebApp Header Color if available
      const tg = (window as any).Telegram?.WebApp;
      if (tg) {
          const headerColor = theme === 'dark' ? '#050505' : '#ffffff';
          if (tg.setHeaderColor) tg.setHeaderColor(headerColor);
          if (tg.setBackgroundColor) tg.setBackgroundColor(headerColor);
      }
  }, [theme]);

  const toggleTheme = () => {
      triggerHaptic('selection');
      setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Loading & Init State
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [initError, setInitError] = useState<string | null>(null);
  const [loadingStatusText, setLoadingStatusText] = useState("Настраиваем AI стилиста...");

  // Auth State
  const [user, setUser] = useState<TelegramUser | null>(null);

  // App Flow State
  const [appState, setAppState] = useState<AppState>(AppState.UPLOAD);
  const [setupStep, setSetupStep] = useState<number>(1);
  const [isPro, setIsPro] = useState(false);
  
  // Config State
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig>({ 
      price: "490.00", 
      productTitle: "StyleVision AI+", 
      productDescription: "",
      maintenanceMode: false,
      freeLimit: 3,
      freeCooldownHours: 8,
      subscriptionPrices: {
          month_1: 490,
          month_3: 650,
          month_6: 850
      }
  });
  
  // Derive subscription plans from config
  const subscriptionPlans: SubscriptionPlan[] = useMemo(() => [
      { 
        id: 'month_1', 
        months: 1, 
        price: globalConfig.subscriptionPrices.month_1, 
        label: '1 Месяц', 
        description: 'Старт' 
      },
      { 
        id: 'month_3', 
        months: 3, 
        price: globalConfig.subscriptionPrices.month_3, 
        label: '3 Месяца', 
        description: 'Выгодно' 
      },
      { 
        id: 'month_6', 
        months: 6, 
        price: globalConfig.subscriptionPrices.month_6, 
        label: '6 Месяцев', 
        description: 'Максимум',
        isBestValue: true
      }
  ], [globalConfig.subscriptionPrices]);
  
  // Overlays
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showAuthRequest, setShowAuthRequest] = useState(false);
  const [showAdminPanel, setShowAdminPanel] = useState(false); 
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [showGuestLockModal, setShowGuestLockModal] = useState(false);
  const [showProInfoModal, setShowProInfoModal] = useState(false);
  
  // Payment Pending Logic
  const [pendingPaymentId, setPendingPaymentId] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlan | null>(null);
  const [isPollingPayment, setIsPollingPayment] = useState(false);
  const paymentPollInterval = useRef<any>(null);

  // Set default plan when config loads
  useEffect(() => {
      if (subscriptionPlans.length > 1) {
          setSelectedPlan(subscriptionPlans[1]);
      } else if (subscriptionPlans.length > 0) {
          setSelectedPlan(subscriptionPlans[0]);
      }
  }, [subscriptionPlans]);

  // Data State
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [currentImage, setCurrentImage] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<UserAnalysis | null>(null);
  const [recommendations, setRecommendations] = useState<StyleRecommendation[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false); // New state for loading more
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
  
  // Editing State
  const [editPrompt, setEditPrompt] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper: Is Admin?
  const isAdmin = (id: number) => ADMIN_IDS.includes(id);

  // Helper: Download Image (Robust with Context Check)
  const downloadImage = async (dataUrl: string, filename: string) => {
    triggerHaptic('light');
    const tg = (window as any).Telegram?.WebApp;
    const isTelegram = !!tg?.initData;

    if (isTelegram) {
        if (dataUrl.startsWith('http')) {
             tg.openLink(dataUrl);
        } else {
             if (!user) {
                 alert("Для скачивания нужна авторизация");
                 return;
             }
             setIsProcessing(true);
             setProcessingMessage("Подготовка файла...");
             try {
                 const publicUrl = await storageService.uploadPublicImage(user.id, dataUrl);
                 if (publicUrl) {
                     tg.openLink(publicUrl);
                 } else {
                     alert("Не удалось подготовить изображение. Попробуйте позже.");
                 }
             } catch (e) {
                 console.error("Upload failed", e);
                 alert("Ошибка при скачивании.");
             } finally {
                 setIsProcessing(false);
             }
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

  const handleShareStory = async () => {
      const tg = (window as any).Telegram?.WebApp;
      if (!tg || !tg.initData || !currentImage || !user) return;

      try {
          triggerHaptic('medium');
          setIsProcessing(true);
          setProcessingMessage("Создаем красивую историю...");
          const storyDataUrl = await generateStoryImage(currentImage);
          setProcessingMessage("Загружаем в Telegram...");
          const publicUrl = await storageService.uploadPublicImage(user.id, storyDataUrl);

          if (!publicUrl) throw new Error("Не удалось загрузить изображение для истории");

          if (tg.shareToStory) {
              tg.shareToStory(publicUrl, { text: 'Мой новый образ от StyleVision ✨' });
              triggerHaptic('success');
          } else {
              alert("Ваша версия Telegram не поддерживает публикации в истории. Обновите приложение.");
          }
      } catch (e: any) {
          console.error("Share Story Failed:", e);
          triggerHaptic('error');
          alert("Ошибка при создании истории. Попробуйте позже.");
      } finally {
          setIsProcessing(false);
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
        const [savedHistory, proStatus] = await Promise.all([
            storageService.getHistory(userId),
            storageService.getProStatus(userId)
        ]);
        setHistory(savedHistory);
        const storedPendingId = localStorage.getItem('pending_payment_id');
        if (storedPendingId) {
            setPendingPaymentId(storedPendingId);
            const isPaid = await checkPaymentStatus(storedPendingId);
            if (isPaid) processSuccessfulPayment(storedPendingId);
        } else {
            setIsPro(proStatus);
        }
    } catch (e) { console.error("Failed to load user extra data", e); }
  };

  const checkLimit = async (): Promise<boolean> => {
     if (!user) return false;
     if (isPro) return true;
     const count = await storageService.getRecentGenerationsCount(user.id, globalConfig.freeCooldownHours); 
     if (count >= globalConfig.freeLimit) {
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
     setShowHistory(false);
     setSetupStep(1); 
     if (item.analysis) setAnalysis(item.analysis);
     if (item.recommendations) {
        setRecommendations(item.recommendations);
        if (item.recommendations.length > 0) setSelectedStyleId(item.recommendations[0].id);
     }
  };

  useEffect(() => { window.scrollTo(0, 0); }, [appState, setupStep]);

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
            if (!!tg?.initData) {
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
          15 
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

  const handleLoadMore = async () => {
    if (!analysis) return;
    try {
        setIsLoadingMore(true);
        triggerHaptic('medium');
        const newStyles = await getStyleRecommendations(
            analysis, 
            stores, 
            { season: selectedSeason, occasion: selectedOccasion },
            undefined, 8
        );
        const uniqueNewStyles = newStyles.map(s => ({
            ...s, id: `style_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }));
        setRecommendations(prev => [...prev, ...uniqueNewStyles]);
        triggerHaptic('success');
    } catch (e) {
        console.error(e);
        triggerHaptic('error');
        alert("Не удалось загрузить дополнительные образы.");
    } finally { setIsLoadingMore(false); }
  };

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
          originalImage, prompt, undefined, (msg) => setProcessingMessage(msg)
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
            currentImage, prompt, mask, (msg) => setProcessingMessage(msg)
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
     setShowProInfoModal(false);
  };

  const handleGuestToLogin = () => {
      setShowGuestLockModal(false);
      handleLogout();
  };
  
  const handleProfileClick = () => {
      triggerHaptic('light');
      if (user?.isGuest) {
          handleLogout();
      } else {
          setShowProInfoModal(true);
      }
  };

  const cancelPendingPayment = () => {
      setPendingPaymentId(null);
      localStorage.removeItem('pending_payment_id');
      localStorage.removeItem('pending_payment_months');
      clearInterval(paymentPollInterval.current);
      setShowPaymentModal(false);
  }

  const isTelegram = !!(window as any).Telegram?.WebApp?.initData;

  if (isLoading) {
      return (
          <LoadingScreen 
            progress={loadingProgress} 
            error={initError} 
            onRetry={handleRetryInit}
            message={loadingStatusText}
            theme={theme}
          />
      );
  }

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  if (globalConfig.maintenanceMode && !isAdmin(user.id) && user.id !== MODERATOR_ID) {
      return (
          <div className="min-h-screen bg-white dark:bg-[#050505] flex flex-col items-center justify-center p-6 text-center animate-fade-in transition-colors duration-300">
              <div className="w-24 h-24 bg-yellow-900/20 border border-yellow-600/50 rounded-full flex items-center justify-center mb-8">
                  <svg className="w-12 h-12 text-yellow-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
              </div>
              <h1 className="text-3xl font-serif text-gray-900 dark:text-white mb-4">Мы обновляемся</h1>
              <p className="text-gray-500 dark:text-neutral-400 max-w-md mb-8 leading-relaxed">
                  В данный момент проводятся технические работы.
              </p>
          </div>
      );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-[#050505] text-gray-800 dark:text-neutral-300 font-sans flex flex-col relative pb-20 md:pb-12 overflow-x-hidden transition-colors duration-500 ease-in-out">
      
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 dark:bg-black/80 border-b border-gray-200 dark:border-neutral-800 transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          
          {/* LEFT SIDE: LOGO & AI+ BUTTON */}
          <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 cursor-pointer group" onClick={resetApp}>
                <div className="w-8 h-8 border border-gray-200 dark:border-neutral-700 flex items-center justify-center bg-gray-50 dark:bg-neutral-900 rounded transition-colors">
                  <span className="font-serif text-xl text-tangerine-500 dark:text-amber-500">S</span>
                </div>
                <h1 className="text-xl font-serif text-gray-900 dark:text-white tracking-widest hidden md:block">
                  STYLE<span className="font-sans font-light text-gray-400 dark:text-neutral-500 text-sm ml-1">VISION</span>
                </h1>
              </div>

             {!isPro ? (
                <button 
                  onClick={handleBuyProClick}
                  className="bg-gradient-to-r from-tangerine-500 to-tangerine-400 dark:from-amber-600 dark:to-amber-500 hover:brightness-110 text-white dark:text-black text-xs font-bold px-4 py-2 rounded-full transition-all shadow-lg shadow-tangerine-500/20 dark:shadow-amber-900/20 flex items-center gap-1.5"
                >
                    <span className="hidden sm:inline">Купить AI+</span>
                    <span className="sm:hidden">AI+</span>
                </button>
             ) : (
                <button 
                  onClick={() => setShowProInfoModal(true)}
                  className="border border-tangerine-500/50 dark:border-amber-500/50 bg-transparent hover:bg-tangerine-50 dark:hover:bg-amber-900/20 text-tangerine-600 dark:text-amber-500 text-xs font-bold px-4 py-2 rounded-full transition-all flex items-center gap-1.5"
                >
                    <span className="hidden sm:inline">AI+ Active</span>
                    <span className="sm:hidden">AI+</span>
                </button>
             )}
          </div>
          
          {/* RIGHT SIDE: CONTROLS */}
          <div className="flex items-center gap-4">
             {/* iOS Style Theme Toggle */}
             <div 
               onClick={toggleTheme}
               className={`w-12 h-7 flex items-center bg-gray-200 dark:bg-neutral-800 rounded-full p-1 cursor-pointer transition-colors duration-300 border border-gray-300 dark:border-neutral-700`}
               title={theme === 'dark' ? "Включить светлую тему" : "Включить темную тему"}
             >
                <div 
                  className={`bg-white dark:bg-black w-5 h-5 rounded-full shadow-sm transform transition-transform duration-300 flex items-center justify-center text-[10px] ${theme === 'dark' ? 'translate-x-5 text-amber-500' : 'translate-x-0 text-tangerine-500'}`}
                >
                   {theme === 'dark' ? (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-3.03 0-5.5-2.47-5.5-5.5 0-1.82.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z"/></svg>
                   ) : (
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 000-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 000 1.41.996.996 0 001.41 0l1.06-1.06c.39-.39.39-1.03 0-1.41s-1.03-.39-1.41 0l-1.06 1.06z"/></svg>
                   )}
                </div>
             </div>

             {appState !== AppState.UPLOAD && (
                 <button 
                    onClick={resetApp}
                    className="hidden sm:flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white transition-colors border border-gray-200 dark:border-neutral-800 rounded-full px-3 py-1.5 bg-gray-50 dark:bg-neutral-900/50"
                 >
                     <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                     <span className="hidden md:inline">Главная</span>
                 </button>
             )}

             {isAdmin(user.id) && (
                <button 
                  onClick={() => setShowAdminPanel(true)}
                  className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900 text-red-600 dark:text-red-500 text-xs font-bold px-3 py-1 rounded hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                >
                  ADMIN
                </button>
             )}

             <div 
                onClick={handleProfileClick}
                className={`hidden md:flex cursor-pointer items-center gap-2 text-xs border border-gray-200 dark:border-neutral-800 rounded-full px-3 py-1 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 transition-all group ${user.isGuest ? 'text-gray-600 dark:text-neutral-500 hover:border-red-300 dark:hover:border-red-900/30' : 'text-tangerine-600 dark:text-amber-500 border-tangerine-200 dark:border-amber-900/30 hover:border-tangerine-500 dark:hover:border-amber-500'}`}
                title={user.isGuest ? "Нажмите чтобы войти" : "Профиль"}
             >
                <span className={`w-2 h-2 rounded-full ${user.isGuest ? 'bg-gray-400 dark:bg-neutral-500' : 'bg-green-500'}`}></span>
                {user.username || user.first_name}
             </div>
             
             <button onClick={() => { setShowHistory(true); triggerHaptic('light'); }} className="text-gray-600 dark:text-neutral-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-2">
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

      {/* SUBSCRIPTION INFO MODAL */}
      {showProInfoModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-sm bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-8 shadow-2xl overflow-hidden text-center transition-colors">
                <button onClick={() => setShowProInfoModal(false)} className="absolute top-4 right-4 text-gray-400 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-neutral-800 border border-gray-200 dark:border-neutral-700 flex items-center justify-center overflow-hidden">
                    {user.photo_url ? (
                        <img src={user.photo_url} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-2xl">👤</span>
                    )}
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{user.first_name}</h2>
                <p className="text-xs text-gray-500 dark:text-neutral-500 mb-6">@{user.username || 'user'}</p>

                {isPro ? (
                    <div className="bg-tangerine-50 dark:bg-amber-900/10 border border-tangerine-200 dark:border-amber-500/30 rounded-xl p-4 mb-6">
                        <div className="flex items-center justify-center gap-2 mb-2">
                           <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                           <h3 className="text-tangerine-600 dark:text-amber-500 font-bold uppercase tracking-widest text-xs">AI+ Активен</h3>
                        </div>
                        {user?.subscriptionExpiresAt && (
                           <p className="text-gray-600 font-medium dark:text-neutral-400 text-xs">
                              Действует до: <span className="text-gray-900 dark:text-white font-bold">{new Date(user.subscriptionExpiresAt).toLocaleDateString()}</span>
                           </p>
                        )}
                    </div>
                ) : (
                    <div className="bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-4 mb-6">
                         <h3 className="text-gray-600 dark:text-neutral-400 font-bold uppercase tracking-widest text-xs mb-2">Базовый аккаунт</h3>
                         <p className="text-gray-500 font-medium dark:text-neutral-500 text-[10px] mb-3">Лимит генераций ограничен</p>
                         <button 
                            onClick={() => { setShowProInfoModal(false); handleBuyProClick(); }}
                            className="w-full bg-tangerine-500 dark:bg-amber-600 text-white dark:text-black font-bold py-2 rounded text-xs hover:bg-tangerine-600 dark:hover:bg-amber-500 transition-colors"
                         >
                            Купить AI+
                         </button>
                    </div>
                )}
                
                <div className="border-t border-gray-200 dark:border-neutral-800 pt-4 text-[10px] text-gray-500 font-medium dark:text-neutral-500 space-y-2 mb-4">
                    <div className="flex justify-center gap-4">
                       <a href="mailto:info@stylevision.fun" className="hover:text-tangerine-500 dark:hover:text-amber-500 flex items-center gap-2 transition-colors">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                          info@stylevision.fun
                       </a>
                    </div>
                </div>

                <button 
                    onClick={handleLogout} 
                    className="text-red-600 dark:text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs font-bold uppercase tracking-wider border border-red-200 dark:border-red-900/30 hover:border-red-600 px-4 py-2 rounded-full transition-all"
                >
                    Выйти из аккаунта
                </button>
             </div>
        </div>
      )}

      {/* GUEST LOCK MODAL */}
      {showGuestLockModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border border-tangerine-200 dark:border-amber-900/50 rounded-2xl p-8 shadow-2xl overflow-hidden transition-colors">
                <button onClick={() => setShowGuestLockModal(false)} className="absolute top-4 right-4 text-gray-400 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 flex items-center justify-center">
                        <span className="text-3xl">🔒</span>
                    </div>
                    <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-3">Только для авторизованных</h2>
                    <p className="text-gray-600 font-medium dark:text-neutral-400 text-sm mb-6 leading-relaxed">
                        Гостевой режим позволяет только загрузить фото. Чтобы создать персональный стиль, примерить образы и использовать редактор, пожалуйста, войдите через Telegram.
                    </p>
                    <button 
                        onClick={handleGuestToLogin}
                        className="w-full bg-black dark:bg-white text-white dark:text-black font-bold py-3.5 rounded-xl hover:bg-gray-800 dark:hover:bg-neutral-200 transition-colors uppercase tracking-wider text-xs"
                    >
                        Войти через Telegram
                    </button>
                </div>
            </div>
         </div>
      )}

      {/* LIMIT MODAL */}
      {showLimitModal && (
         <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/90 backdrop-blur-md animate-fade-in">
             <div className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border border-tangerine-200 dark:border-amber-900/50 rounded-2xl p-8 shadow-2xl overflow-hidden transition-colors">
                <button onClick={() => setShowLimitModal(false)} className="absolute top-4 right-4 text-gray-400 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="text-center">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 flex items-center justify-center">
                        <span className="text-3xl">⏳</span>
                    </div>
                    <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-3">Лимит исчерпан</h2>
                    <p className="text-gray-600 font-medium dark:text-neutral-400 text-sm mb-6 leading-relaxed">
                        В бесплатной версии доступно только <strong>{globalConfig.freeLimit} генерации</strong> каждые {globalConfig.freeCooldownHours} часов. 
                        Вы можете подождать или снять все ограничения прямо сейчас.
                    </p>
                    <div className="space-y-3">
                        <button 
                            onClick={handleBuyProClick}
                            className="w-full bg-gradient-to-r from-tangerine-500 to-tangerine-400 dark:from-amber-600 dark:to-amber-500 text-white dark:text-black font-bold py-3.5 rounded-xl hover:brightness-110 transition-all shadow-lg"
                        >
                            Снять лимиты за {subscriptionPlans[0]?.price || '490'}₽
                        </button>
                        <button 
                            onClick={() => setShowLimitModal(false)}
                            className="w-full bg-gray-100 dark:bg-neutral-900 text-gray-700 dark:text-neutral-400 hover:text-black dark:hover:text-white font-medium py-3.5 rounded-xl border border-gray-200 dark:border-neutral-800 transition-colors"
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
            <div className="absolute inset-0 bg-black/50 dark:bg-black/80 backdrop-blur-sm" onClick={() => setShowHistory(false)}></div>
            <div className="relative w-full max-w-md bg-white dark:bg-[#0a0a0a] border-l border-gray-200 dark:border-neutral-800 h-full overflow-y-auto p-6 animate-fade-in shadow-2xl scrollbar-hide transition-colors">
               <div className="flex justify-between items-center mb-8">
                  <h2 className="font-serif text-2xl text-gray-900 dark:text-white">Ваш Гардероб</h2>
                  <button onClick={() => setShowHistory(false)} className="p-2 text-gray-500 dark:text-gray-400"><svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg></button>
               </div>
               <div className="space-y-6">
                  {history.map((item) => (
                     <div key={item.id} onClick={() => loadFromHistory(item)} className="cursor-pointer group border border-gray-200 dark:border-neutral-800 hover:border-tangerine-400 dark:hover:border-amber-600/50 bg-gray-50 dark:bg-neutral-900 transition-all relative">
                        <div className="aspect-[3/4] relative overflow-hidden group/image">
                           <img src={item.resultImage || item.originalImage} className="w-full h-full object-cover" alt="History" />
                           <button 
                              onClick={(e) => {
                                 e.stopPropagation();
                                 downloadImage(item.resultImage || item.originalImage, `stylevision_${item.id}.png`);
                              }}
                              className="absolute bottom-2 right-2 w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-black/60 hover:bg-tangerine-500 dark:hover:bg-amber-600 text-gray-900 dark:text-white hover:text-white rounded-full transition-colors backdrop-blur-sm shadow-lg z-10"
                              title="Скачать"
                           >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                           </button>
                           <button 
                              onClick={(e) => handleDeleteHistoryItem(e, item.id)}
                              className="absolute bottom-2 right-12 w-8 h-8 flex items-center justify-center bg-white/80 dark:bg-black/60 hover:bg-red-500 dark:hover:bg-red-600 text-gray-900 dark:text-white hover:text-white rounded-full transition-colors backdrop-blur-sm shadow-lg z-10"
                              title="Удалить"
                           >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                           </button>
                        </div>
                        <div className="p-4">
                           <h4 className="font-serif text-lg text-gray-900 dark:text-white mb-1">{item.styleTitle}</h4>
                           <p className="text-xs text-gray-600 font-medium dark:text-neutral-500">{item.date}</p>
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 dark:bg-black/90 backdrop-blur-md animate-fade-in overflow-y-auto">
             <div className="relative w-full max-w-lg bg-white dark:bg-[#0a0a0a] border border-gray-200 dark:border-neutral-800 rounded-2xl p-6 md:p-8 shadow-2xl my-auto transition-colors">
                <button onClick={() => setShowPaymentModal(false)} className="absolute top-4 right-4 text-gray-400 dark:text-neutral-500 hover:text-gray-800 dark:hover:text-white">
                    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <div className="relative z-10 text-center">
                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-tangerine-400 to-tangerine-600 dark:from-amber-400 dark:to-amber-700 p-[1px]">
                        <div className="w-full h-full rounded-full bg-white dark:bg-black flex items-center justify-center">
                            <span className="font-serif text-3xl text-tangerine-500 dark:text-amber-500 italic">S</span>
                        </div>
                    </div>
                    {!pendingPaymentId ? (
                        <>
                            <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-1">Выберите тариф</h2>
                            
                            {/* NEW: Benefits Section */}
                            <div className="bg-tangerine-50 dark:bg-neutral-900/50 border border-tangerine-100 dark:border-neutral-800 rounded-xl p-4 mb-6 mt-4 text-left">
                                <h3 className="text-gray-900 dark:text-white font-medium mb-3 text-sm">Преимущества AI+:</h3>
                                <ul className="space-y-2">
                                    <li className="flex items-center gap-2 text-xs text-gray-700 font-medium dark:text-neutral-300">
                                        <span className="text-tangerine-500 dark:text-amber-500 font-bold">✓</span> Снятие всех лимитов
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-700 font-medium dark:text-neutral-300">
                                        <span className="text-tangerine-500 dark:text-amber-500 font-bold">✓</span> Генерация без очередей
                                    </li>
                                    <li className="flex items-center gap-2 text-xs text-gray-700 font-medium dark:text-neutral-300">
                                        <span className="text-tangerine-500 dark:text-amber-500 font-bold">✓</span> Доступ к премиум стилям
                                    </li>
                                </ul>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                                {subscriptionPlans.map(plan => (
                                    <div 
                                        key={plan.id}
                                        onClick={() => { triggerHaptic('selection'); setSelectedPlan(plan); }}
                                        className={`
                                            relative cursor-pointer p-4 rounded-xl border transition-all duration-300 flex flex-col items-center justify-center
                                            ${selectedPlan?.id === plan.id 
                                                ? 'bg-tangerine-50 dark:bg-neutral-800 border-tangerine-500 dark:border-amber-500 shadow-lg shadow-tangerine-200 dark:shadow-amber-900/20 transform scale-105 z-10' 
                                                : 'bg-gray-50 dark:bg-neutral-900/50 border-gray-200 dark:border-neutral-800 hover:bg-gray-100 dark:hover:bg-neutral-800 hover:border-gray-300 dark:hover:border-neutral-700 opacity-80 hover:opacity-100'}
                                        `}
                                    >
                                        <div className="text-[10px] text-tangerine-600 dark:text-amber-600 font-bold uppercase tracking-wider mb-1">
                                            {plan.description}
                                        </div>
                                        <div className="text-sm text-gray-600 font-medium dark:text-neutral-400 mb-1">
                                            {plan.label}
                                        </div>
                                        <div className={`text-xl font-bold ${selectedPlan?.id === plan.id ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-neutral-200'}`}>
                                            {plan.price} ₽
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <button 
                                onClick={() => selectedPlan && initiatePayment(selectedPlan)}
                                disabled={isProcessing || !selectedPlan}
                                className="w-full bg-gradient-to-r from-tangerine-500 to-tangerine-400 dark:from-amber-600 dark:to-amber-500 hover:brightness-110 text-white dark:text-black font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isProcessing ? (
                                    <div className="animate-spin w-5 h-5 border-2 border-white/50 dark:border-black/50 border-t-transparent rounded-full"></div>
                                ) : (
                                    <><span>Оплатить {selectedPlan?.price} ₽ через ЮKassa</span></>
                                )}
                            </button>
                            
                            {/* Terms Disclaimer */}
                            <p className="text-[10px] text-gray-500 font-medium dark:text-neutral-500 mt-3 text-center leading-normal">
                                Нажимая кнопку, вы соглашаетесь с <br />
                                <a 
                                    href="https://stylevision.fun/offer.html" 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        const tg = (window as any).Telegram?.WebApp;
                                        if (tg && tg.initData) {
                                            tg.openLink("https://stylevision.fun/offer.html");
                                        } else {
                                            window.open("https://stylevision.fun/offer.html", "_blank");
                                        }
                                    }}
                                    className="text-gray-600 dark:text-neutral-400 hover:text-tangerine-500 dark:hover:text-amber-500 underline transition-colors cursor-pointer"
                                >
                                    публичной офертой
                                </a>
                            </p>
                        </>
                    ) : (
                        <div className="animate-fade-in">
                            <h2 className="text-xl font-serif text-gray-900 dark:text-white mb-4">Ожидание оплаты...</h2>
                            <button onClick={cancelPendingPayment} className="text-xs text-gray-600 font-medium dark:text-neutral-500 hover:text-black dark:hover:text-white border-b border-gray-300 dark:border-neutral-700 hover:border-black dark:hover:border-white pb-0.5 transition-all">Отменить</button>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      <main className="flex-grow w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Upload State */}
        {appState === AppState.UPLOAD && (
          <div className="flex flex-col items-center justify-center min-h-[70vh] animate-fade-in-up">
            <div className="text-center max-w-3xl mx-auto mb-12 md:mb-16 px-4">
              <span className="text-tangerine-600 dark:text-amber-500 text-[10px] md:text-xs font-bold tracking-[0.3em] uppercase mb-4 block">AI Stylist</span>
              <h2 className="text-4xl md:text-6xl font-serif mb-6 text-gray-900 dark:text-white leading-tight">
                Ваш Идеальный <br /><span className="italic text-gray-500 dark:text-neutral-400">Стиль</span>
              </h2>
              <p className="text-gray-600 font-medium dark:text-neutral-500 text-sm md:text-lg max-w-xl mx-auto">
                 Загрузите фото для анализа внешности и подбора гардероба.
              </p>
            </div>

            <div onClick={() => { triggerHaptic('light'); fileInputRef.current?.click(); }} className="w-full max-w-md aspect-[3/2] border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-900/30 hover:bg-gray-100 dark:hover:bg-neutral-900 transition-all cursor-pointer flex flex-col items-center justify-center">
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
              <div className="w-16 h-16 rounded-full border border-gray-200 dark:border-neutral-700 flex items-center justify-center bg-white dark:bg-black mb-4 shadow-sm">
                 <svg className="w-8 h-8 text-gray-400 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <p className="text-gray-700 font-medium dark:text-white uppercase tracking-widest text-sm">Загрузить фото</p>
            </div>
          </div>
        )}

        {/* Wizard State */}
        {appState === AppState.PREVIEW && originalImage && (
           <div className="max-w-4xl mx-auto animate-fade-in">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                 {/* Left: Preview */}
                 <div className="hidden md:block relative aspect-[3/4] border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-black">
                    <img src={originalImage} alt="Preview" className="w-full h-full object-cover opacity-90" />
                 </div>

                 {/* Right: Setup */}
                 <div className="space-y-6">
                    {setupStep === 1 ? (
                      <div className="animate-fade-in">
                         <h2 className="text-2xl font-serif text-gray-900 dark:text-white mb-6">Создаем контекст</h2>
                         <div className="space-y-6">
                            <div>
                               <label className="text-xs text-tangerine-600 dark:text-amber-600 font-bold uppercase tracking-widest block mb-3">
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
                                        className={`flex flex-col items-center justify-center p-3 text-sm border rounded-lg transition-all ${selectedSeason === s.id ? 'bg-tangerine-50 dark:bg-amber-900/20 border-tangerine-500 dark:border-amber-600 text-tangerine-700 dark:text-white' : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-600 font-medium dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-600'}`}
                                     >
                                        <span className="text-xs font-medium">{s.l}</span>
                                     </button>
                                  ))}
                               </div>
                            </div>
                            <div>
                               <label className="text-xs text-tangerine-600 dark:text-amber-600 font-bold uppercase tracking-widest block mb-3">
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
                                        className={`text-left p-3 border rounded-lg transition-all ${selectedOccasion === o.id ? 'bg-tangerine-50 dark:bg-neutral-800 border-tangerine-500 dark:border-amber-600 text-gray-900 dark:text-white' : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 text-gray-600 font-medium dark:text-neutral-500 hover:border-gray-300 dark:hover:border-neutral-600'}`}
                                     >
                                        <div className="font-medium text-sm">{o.l}</div>
                                        <div className="text-[10px] opacity-60">{o.d}</div>
                                     </button>
                                  ))}
                               </div>
                            </div>
                            <button onClick={() => { triggerHaptic('light'); setSetupStep(2); }} className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-4 font-serif uppercase tracking-widest mt-4 hover:bg-gray-700 dark:hover:bg-neutral-200 transition-colors rounded">Далее</button>
                         </div>
                      </div>
                    ) : (
                      <div className="animate-fade-in">
                         <div className="flex items-center gap-4 mb-6">
                           <button onClick={() => { triggerHaptic('light'); setSetupStep(1); }} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-neutral-800 rounded-full text-gray-600 dark:text-neutral-500 hover:text-black dark:hover:text-white">
                             <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                           </button>
                           <h2 className="text-2xl font-serif text-gray-900 dark:text-white">Где искать вещи?</h2>
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
                                        ? 'bg-white dark:bg-neutral-800 border-tangerine-400 dark:border-amber-600/50 shadow-md' 
                                        : 'bg-gray-50 dark:bg-neutral-900 border-gray-200 dark:border-neutral-800 opacity-60 hover:opacity-100 hover:border-gray-300 dark:hover:border-neutral-700'}
                                    `}
                                  >
                                     <div className="flex items-center gap-3 overflow-hidden">
                                        <div className="w-10 h-10 rounded bg-white p-1 flex-shrink-0 flex items-center justify-center overflow-hidden border border-gray-200 dark:border-neutral-200">
                                           <img src={store.logoUrl} alt={store.name} className="w-full h-full object-contain" />
                                        </div>
                                        <span className={`text-sm font-medium truncate ${store.isSelected ? 'text-gray-900 dark:text-white' : 'text-gray-500 dark:text-neutral-400'}`}>
                                           {store.name}
                                        </span>
                                     </div>
                                     <div className={`w-5 h-5 rounded-full border flex items-center justify-center ${store.isSelected ? 'bg-tangerine-500 dark:bg-amber-600 border-tangerine-500 dark:border-amber-600' : 'border-gray-300 dark:border-neutral-600'}`}>
                                        {store.isSelected && <svg className="w-3 h-3 text-white dark:text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                                     </div>
                                  </div>
                               ))}
                            </div>

                            <div className="pt-4 border-t border-gray-200 dark:border-neutral-800">
                               <label className="text-xs text-tangerine-600 dark:text-amber-600 font-bold uppercase tracking-widest block mb-3">АНАЛИЗ</label>
                               <div className="grid grid-cols-2 gap-3 mb-4">
                                  <button onClick={() => handleModeChange('STANDARD')} className={`p-3 border rounded text-xs uppercase tracking-wider transition-all ${analysisMode === 'STANDARD' ? 'border-tangerine-500 dark:border-amber-600 bg-tangerine-50 dark:bg-amber-900/10 text-tangerine-700 dark:text-white' : 'border-gray-200 dark:border-neutral-800 text-gray-600 font-medium dark:text-neutral-500 hover:border-gray-400 dark:hover:border-neutral-600'}`}>
                                     СТАНДАРТНЫЙ
                                  </button>
                                  <button onClick={() => handleModeChange('OBJECTIVE')} className={`p-3 border rounded text-xs uppercase tracking-wider transition-all ${analysisMode === 'OBJECTIVE' ? 'border-tangerine-500 dark:border-amber-600 bg-tangerine-50 dark:bg-amber-900/10 text-tangerine-700 dark:text-white' : 'border-gray-200 dark:border-neutral-800 text-gray-600 font-medium dark:text-neutral-500 hover:border-gray-400 dark:hover:border-neutral-600'}`}>
                                     ОБЪЕКТИВНЫЙ
                                  </button>
                                </div>
                               
                               {showObjectiveWarning && (
                                  <div className="bg-orange-50 dark:bg-amber-900/20 border border-orange-200 dark:border-amber-700/30 p-3 rounded mb-4 animate-fade-in">
                                     <p className="text-[11px] text-orange-700 dark:text-amber-200/80 leading-relaxed">
                                        ⚠️ <strong>Внимание:</strong> Объективный режим может быть довольно прямолинейным. 
                                        ИИ укажет на особенности внешности честно.
                                     </p>
                                  </div>
                               )}
                            </div>
                            
                            <button onClick={startFlow} className="w-full bg-gray-900 dark:bg-white text-white dark:text-black py-4 font-serif uppercase tracking-widest hover:bg-tangerine-600 dark:hover:bg-amber-500 transition-colors shadow-lg rounded">Создать Стиль</button>
                         </div>
                      </div>
                    )}
                 </div>
              </div>
           </div>
        )}

        {/* Analyzing State - RESTORED */}
        {appState === AppState.ANALYZING && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] animate-fade-in text-center px-4">
             <div className="w-24 h-24 border-4 border-gray-200 dark:border-neutral-800 border-t-tangerine-500 dark:border-t-amber-600 rounded-full animate-spin mb-8"></div>
             <h2 className="text-2xl md:text-3xl font-serif text-gray-900 dark:text-white mb-4 animate-pulse">
               {processingMessage || 'Анализируем фото...'}
             </h2>
             <p className="text-gray-600 font-medium dark:text-neutral-500 max-w-md mx-auto leading-relaxed">
               Искусственный интеллект изучает особенности вашей внешности, чтобы подобрать идеальный стиль.
             </p>
          </div>
        )}

        {/* Results State - RESTORED TO CLASSIC LAYOUT */}
        {appState === AppState.RESULTS && (
           <div className="max-w-7xl mx-auto animate-fade-in pb-20">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 items-start">
                  {/* Left Column: Image Area & Analysis */}
                  <div className="space-y-6">
                      <div className="aspect-[3/4] relative rounded-xl overflow-hidden border border-gray-200 dark:border-neutral-800 bg-gray-100 dark:bg-black">
                         {/* Main Image Display */}
                         {currentImage ? (
                            <div className="relative w-full h-full">
                               <BeforeAfterSlider 
                                  beforeImage={originalImage!} 
                                  afterImage={currentImage} 
                               />
                               {/* Actions overlay */}
                               <div className="absolute bottom-4 right-4 flex gap-2 z-20">
                                  {/* SHARE TO STORY BUTTON (Telegram Only) */}
                                  {isTelegram && (
                                      <button 
                                        onClick={handleShareStory}
                                        disabled={isProcessing}
                                        className="bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 text-tangerine-600 dark:text-amber-500 p-2 rounded-full backdrop-blur transition-all border border-tangerine-200 dark:border-amber-900/30"
                                        title="В историю"
                                      >
                                          {/* Story Icon */}
                                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                          </svg>
                                      </button>
                                  )}

                                  <button onClick={() => downloadImage(currentImage, `stylevision_${Date.now()}.png`)} className="bg-white/80 dark:bg-black/50 hover:bg-white dark:hover:bg-black/70 text-gray-900 dark:text-white p-2 rounded-full backdrop-blur transition-all">
                                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                  </button>
                               </div>
                            </div>
                         ) : (
                            <div className="animate-pulse bg-gray-100 dark:bg-neutral-900 w-full h-full flex items-center justify-center">
                                <span className="text-gray-400 dark:text-neutral-700">Загрузка изображения...</span>
                            </div>
                         )}
                         
                         {/* Processing Overlay inside Image Area */}
                         {isProcessing && (
                             <div className="absolute inset-0 bg-white/80 dark:bg-black/60 backdrop-blur-sm z-30 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
                                 <div className="w-16 h-16 border-4 border-tangerine-500 dark:border-amber-600 border-t-transparent rounded-full animate-spin mb-6"></div>
                                 <p className="text-xl font-serif text-gray-900 dark:text-white mb-2">{processingMessage || 'Обработка...'}</p>
                                 <p className="text-sm text-gray-500 dark:text-neutral-400">Это может занять 10-20 секунд</p>
                             </div>
                         )}
                      </div>
                      
                      <ImageEditor 
                        originalImage={currentImage || originalImage!} 
                        onEdit={handleEdit} 
                        isProcessing={isProcessing} 
                     />

                      {/* Analysis Block (Restored) */}
                      {analysis && (
                          <div className="bg-white dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800 rounded-xl p-5 mt-6 animate-fade-in">
                              <h3 className="text-lg font-serif text-gray-900 dark:text-white mb-3">Результаты Анализа</h3>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-xs text-gray-700 font-medium dark:text-neutral-300 border border-gray-200 dark:border-neutral-700">Пол: {analysis.gender}</span>
                                  <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-xs text-gray-700 font-medium dark:text-neutral-300 border border-gray-200 dark:border-neutral-700">Фигура: {analysis.bodyType}</span>
                                  <span className="px-3 py-1 rounded-full bg-gray-100 dark:bg-neutral-800 text-xs text-gray-700 font-medium dark:text-neutral-300 border border-gray-200 dark:border-neutral-700">Цветотип: {analysis.seasonalColor}</span>
                              </div>
                              <p className="text-sm text-gray-600 font-medium dark:text-neutral-400 leading-relaxed mb-4">{analysis.detailedDescription}</p>
                              <div className="flex flex-wrap gap-2">
                                  {analysis.styleKeywords.map((kw, i) => (
                                      <span key={i} className="text-[10px] uppercase font-bold text-tangerine-600 dark:text-amber-600 tracking-wider">#{kw}</span>
                                  ))}
                              </div>
                          </div>
                      )}
                  </div>

                  {/* Right Column: Recommendations */}
                  <div className="space-y-6">
                       <div className="flex items-center justify-between">
                           <h3 className="font-serif text-2xl text-gray-900 dark:text-white">Рекомендации</h3>
                           <span className="text-gray-500 dark:text-neutral-500 text-sm">{recommendations.length} образов</span>
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
                                <div className="text-center text-gray-500 dark:text-neutral-500 py-10 border border-gray-200 dark:border-neutral-800 rounded-xl bg-gray-50 dark:bg-neutral-900/30">
                                    <p>Нет рекомендаций. Попробуйте изменить параметры анализа или перезагрузить страницу.</p>
                                </div>
                           )}

                           {/* Load More Button */}
                           {recommendations.length > 0 && (
                                <button 
                                    onClick={handleLoadMore}
                                    disabled={isLoadingMore || isProcessing}
                                    className="w-full py-4 rounded-xl border border-gray-200 dark:border-neutral-800 text-gray-600 font-medium dark:text-neutral-400 hover:text-black dark:hover:text-white hover:bg-gray-50 dark:hover:bg-neutral-900 transition-all uppercase tracking-widest text-xs mt-4 flex items-center justify-center gap-2"
                                >
                                    {isLoadingMore ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-tangerine-500 dark:border-amber-600 border-t-transparent rounded-full animate-spin"></div>
                                            <span>Подбираем варианты...</span>
                                        </>
                                    ) : (
                                        <>
                                            <span>Подобрать больше</span>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                            </svg>
                                        </>
                                    )}
                                </button>
                           )}
                       </div>
                  </div>
              </div>
           </div>
        )}

      </main>

      {/* Desktop Footer (Fixed at bottom) */}
      <footer className="hidden md:block fixed bottom-0 left-0 right-0 z-40 bg-white/90 dark:bg-[#050505]/90 backdrop-blur border-t border-gray-200 dark:border-neutral-900 py-3 text-center text-[10px] text-gray-600 font-medium dark:text-neutral-600 transition-colors">
        <div className="max-w-7xl mx-auto px-4 flex justify-between items-center">
            <div className="flex gap-6">
                <a href="mailto:info@stylevision.fun" className="hover:text-tangerine-600 dark:hover:text-amber-600 flex items-center gap-1 transition-colors">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    info@stylevision.fun
                </a>
                <a href="https://t.me/Nikita_Peredvigin" target="_blank" rel="noopener noreferrer" className="hover:text-tangerine-600 dark:hover:text-amber-600 flex items-center gap-1 transition-colors">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                    @Nikita_Peredvigin
                </a>
            </div>
            <div className="flex gap-4">
                <a href="https://stylevision.fun/offer.html" target="_blank" className="hover:text-tangerine-500 dark:hover:text-amber-500 transition-colors">Оферта</a>
                <a href="https://stylevision.fun/privacy.html" target="_blank" className="hover:text-tangerine-500 dark:hover:text-amber-500 transition-colors">Конфиденциальность</a>
            </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
