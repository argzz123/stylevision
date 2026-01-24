
import React, { useState, useEffect } from 'react';
import { storageService, GlobalConfig } from '../services/storageService';
import { getOrFetchApiKey, getApiKeySync } from '../services/geminiService';

interface AdminPanelProps {
  onClose: () => void;
  currentUserId: number;
}

const AdminPanel: React.FC<AdminPanelProps> = ({ onClose, currentUserId }) => {
  const [activeTab, setActiveTab] = useState<'USERS' | 'SYSTEM'>('USERS');
  const [users, setUsers] = useState<any[]>([]);
  const [apiStatus, setApiStatus] = useState<'UNKNOWN' | 'OK' | 'ERROR'>('UNKNOWN');
  const [apiLatency, setApiLatency] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [manualKey, setManualKey] = useState('');

  // Config State
  const [config, setConfig] = useState<GlobalConfig>({ 
      price: "1.00", 
      productTitle: "", 
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

  useEffect(() => {
    loadUsers();
    loadConfig();
    const existingOverride = localStorage.getItem('stylevision_api_key_override');
    if (existingOverride) setManualKey(existingOverride);
  }, []);

  const loadConfig = async () => {
      const c = await storageService.getGlobalConfig();
      setConfig(c);
  };

  const loadUsers = async () => {
    setIsLoading(true);
    const allUsers = await storageService.getAllUsers();
    setUsers(allUsers);
    setIsLoading(false);
  };

  const grantPro = async (targetId: number) => {
    if (window.confirm(`Выдать PRO подписку пользователю ID: ${targetId}?`)) {
        await storageService.setProStatus(targetId, true);
        loadUsers();
        alert(`Подписка выдана пользователю ${targetId}`);
    }
  };

  const revokePro = async (targetId: number) => {
    if (window.confirm(`Отменить подписку у пользователя ID: ${targetId}?`)) {
        await storageService.setProStatus(targetId, false);
        loadUsers();
        alert(`Подписка отменена у пользователя ${targetId}`);
    }
  };

  const handleSaveKey = async () => {
      if (manualKey.trim().length < 20) {
          alert("Ключ слишком короткий");
          return;
      }
      // 1. Save Locally for Admin
      localStorage.setItem('stylevision_api_key_override', manualKey.trim());
      // 2. Save Globally to Supabase
      const savedToDb = await storageService.saveGlobalApiKey(manualKey.trim());
      if (savedToDb) {
          alert("Ключ сохранен в Базе Данных!");
      } else {
          alert("Ошибка сохранения в БД.");
      }
      testApiConnection();
  };

  const handleSaveConfig = async () => {
      await storageService.saveGlobalConfig(config);
      alert("Настройки магазина и системы сохранены!");
  };

  const handleClearKey = () => {
      localStorage.removeItem('stylevision_api_key_override');
      setManualKey('');
      alert("Локальный ключ удален.");
      testApiConnection();
  };

  const testApiConnection = async () => {
     setApiStatus('UNKNOWN');
     const start = Date.now();
     try {
         const key = await getOrFetchApiKey();
         if (!key || key.includes('AIzaSyDS7WO')) throw new Error("API Key not found or invalid");
         if (key.startsWith('AIza')) {
             setApiStatus('OK');
         } else {
             throw new Error("Invalid format");
         }
     } catch (e) {
         console.error(e);
         setApiStatus('ERROR');
     } finally {
         setApiLatency(Date.now() - start);
     }
  };

  const filteredUsers = users.filter(u => 
      (u.first_name || '').toLowerCase().includes(searchQuery.toLowerCase()) || 
      String(u.id).includes(searchQuery) ||
      (u.username && u.username.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const localKey = getApiKeySync();
  const isOverride = !!localStorage.getItem('stylevision_api_key_override');

  return (
    <div className="fixed inset-0 z-[200] bg-[#050505] text-neutral-300 font-sans overflow-y-auto animate-fade-in">
        <div className="max-w-7xl mx-auto p-6">
            
            {/* Header */}
            <div className="flex justify-between items-center mb-8 border-b border-neutral-800 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-900/20 border border-red-600/50 rounded flex items-center justify-center text-red-500 font-bold">
                        ADM
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Панель Администратора</h1>
                        <p className="text-xs text-neutral-500">ID: {currentUserId}</p>
                    </div>
                </div>
                <button onClick={onClose} className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 rounded text-sm text-white transition-colors">
                    Закрыть панель
                </button>
            </div>

            {/* Navigation */}
            <div className="flex gap-4 mb-8">
                <button 
                    onClick={() => setActiveTab('USERS')}
                    className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'USERS' ? 'bg-amber-600 text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white'}`}
                >
                    Пользователи
                </button>
                <button 
                    onClick={() => setActiveTab('SYSTEM')}
                    className={`px-4 py-2 rounded text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'SYSTEM' ? 'bg-amber-600 text-black' : 'bg-neutral-900 text-neutral-500 hover:text-white'}`}
                >
                    Система
                </button>
            </div>

            {/* Users Tab */}
            {activeTab === 'USERS' && (
                <div className="space-y-4 animate-fade-in">
                    <div className="bg-neutral-900 p-4 rounded-lg border border-neutral-800 flex gap-2">
                        <input 
                            type="text" 
                            placeholder="Поиск по ID, Имени или @username"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-black border border-neutral-700 rounded p-3 text-white focus:border-amber-500 outline-none"
                        />
                        <button onClick={loadUsers} className="bg-neutral-800 px-4 rounded hover:bg-neutral-700">
                           🔄
                        </button>
                    </div>

                    {isLoading ? (
                        <div className="text-center py-10">Загрузка данных из БД...</div>
                    ) : (
                        <div className="grid gap-4">
                            {filteredUsers.map(user => (
                                <div key={user.id} className="bg-neutral-900 border border-neutral-800 p-4 rounded-lg flex flex-col md:flex-row justify-between items-center gap-4">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full bg-neutral-800 flex items-center justify-center border border-neutral-700 overflow-hidden">
                                            {user.photo_url ? (
                                                <img src={user.photo_url} className="w-full h-full object-cover" alt="User" />
                                            ) : (
                                                <span className="text-xl">👤</span>
                                            )}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-white text-lg">{user.first_name} {user.last_name}</h3>
                                                {user.isPro && <span className="bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded">PRO</span>}
                                                {user.isGuest && <span className="bg-neutral-700 text-neutral-400 text-[10px] font-bold px-1.5 rounded">GUEST</span>}
                                            </div>
                                            <p className="text-xs text-neutral-500">ID: {user.id} • @{user.username || '---'}</p>
                                        </div>
                                    </div>

                                    <div className="flex gap-2">
                                        {user.isPro ? (
                                            <button onClick={() => revokePro(user.id)} className="px-3 py-1.5 border border-red-900 text-red-500 text-xs rounded hover:bg-red-900/20 transition-colors">
                                                Отнять PRO
                                            </button>
                                        ) : (
                                            <button onClick={() => grantPro(user.id)} className="px-3 py-1.5 bg-green-900/30 border border-green-800 text-green-500 text-xs rounded hover:bg-green-900/50 transition-colors">
                                                Выдать PRO
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                            {filteredUsers.length === 0 && (
                                <div className="text-center py-10 text-neutral-500">Пользователи не найдены</div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* System Tab */}
            {activeTab === 'SYSTEM' && (
                <div className="animate-fade-in space-y-6">
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        
                        {/* Global Config Manager */}
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg md:col-span-2">
                             <h3 className="text-lg font-bold text-white mb-4">Настройки Магазина и Приложения</h3>
                             
                             {/* Maintenance Toggle */}
                             <div className="mb-6 p-4 border border-yellow-900/30 bg-yellow-900/10 rounded-lg flex items-center justify-between">
                                <div>
                                    <h4 className="text-yellow-500 font-bold mb-1">Режим Технических Работ</h4>
                                    <p className="text-xs text-neutral-400">Если включено, пользователи увидят экран "Мы обновляемся". Администраторы продолжат видеть приложение.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input 
                                    type="checkbox" 
                                    checked={config.maintenanceMode} 
                                    onChange={(e) => setConfig({...config, maintenanceMode: e.target.checked})}
                                    className="sr-only peer" 
                                  />
                                  <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-600"></div>
                                </label>
                             </div>

                             {/* Limits Configuration */}
                             <div className="mb-6 border-b border-neutral-800 pb-6">
                                <h4 className="text-sm text-neutral-400 font-bold uppercase tracking-wider mb-4">Лимиты для бесплатных пользователей</h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-xs text-neutral-500 mb-1 block">Лимит генераций</label>
                                        <input 
                                            type="number" 
                                            value={config.freeLimit || 3}
                                            onChange={(e) => setConfig({...config, freeLimit: parseInt(e.target.value) || 0})}
                                            className="w-full bg-black border border-neutral-700 rounded p-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-neutral-500 mb-1 block">Период ожидания (часов)</label>
                                        <input 
                                            type="number" 
                                            value={config.freeCooldownHours || 8}
                                            onChange={(e) => setConfig({...config, freeCooldownHours: parseInt(e.target.value) || 0})}
                                            className="w-full bg-black border border-neutral-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </div>
                             </div>

                             {/* Subscription Prices */}
                             <div className="mb-6 border-b border-neutral-800 pb-6">
                                <h4 className="text-sm text-neutral-400 font-bold uppercase tracking-wider mb-4">Цены Подписок (RUB)</h4>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div>
                                        <label className="text-xs text-neutral-500 mb-1 block">1 Месяц</label>
                                        <input 
                                            type="number" 
                                            value={config.subscriptionPrices?.month_1 || 490}
                                            onChange={(e) => setConfig({
                                                ...config, 
                                                subscriptionPrices: { ...config.subscriptionPrices, month_1: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full bg-black border border-neutral-700 rounded p-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-neutral-500 mb-1 block">3 Месяца</label>
                                        <input 
                                            type="number" 
                                            value={config.subscriptionPrices?.month_3 || 650}
                                            onChange={(e) => setConfig({
                                                ...config, 
                                                subscriptionPrices: { ...config.subscriptionPrices, month_3: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full bg-black border border-neutral-700 rounded p-2 text-white"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs text-neutral-500 mb-1 block">6 Месяцев</label>
                                        <input 
                                            type="number" 
                                            value={config.subscriptionPrices?.month_6 || 850}
                                            onChange={(e) => setConfig({
                                                ...config, 
                                                subscriptionPrices: { ...config.subscriptionPrices, month_6: parseInt(e.target.value) || 0 }
                                            })}
                                            className="w-full bg-black border border-neutral-700 rounded p-2 text-white"
                                        />
                                    </div>
                                </div>
                             </div>

                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs text-neutral-500 mb-1 block">Заголовок продукта</label>
                                    <input 
                                        type="text" 
                                        value={config.productTitle}
                                        onChange={(e) => setConfig({...config, productTitle: e.target.value})}
                                        className="w-full bg-black border border-neutral-700 rounded p-2 text-white"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="text-xs text-neutral-500 mb-1 block">Описание преимуществ</label>
                                    <textarea 
                                        value={config.productDescription}
                                        onChange={(e) => setConfig({...config, productDescription: e.target.value})}
                                        className="w-full bg-black border border-neutral-700 rounded p-2 text-white h-20"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <button onClick={handleSaveConfig} className="bg-green-600 text-white font-bold px-4 py-2 rounded hover:bg-green-500 w-full md:w-auto">
                                        Сохранить настройки
                                    </button>
                                </div>
                             </div>
                        </div>

                        {/* API Status Card */}
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                                Статус Gemini API
                            </h3>
                            
                            <div className="flex items-center gap-4 mb-6">
                                <div className={`w-3 h-3 rounded-full ${apiStatus === 'OK' ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]' : apiStatus === 'ERROR' ? 'bg-red-500' : 'bg-neutral-500'}`}></div>
                                <span className={`font-mono text-lg ${apiStatus === 'OK' ? 'text-green-500' : apiStatus === 'ERROR' ? 'text-red-500' : 'text-neutral-500'}`}>
                                    {apiStatus === 'UNKNOWN' ? 'Не проверено' : apiStatus === 'OK' ? 'ONLINE' : 'ERROR'}
                                </span>
                            </div>

                            <button onClick={testApiConnection} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded transition-colors text-sm">
                                Проверить соединение
                            </button>
                        </div>

                        {/* Global Key Manager */}
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                             <h3 className="text-lg font-bold text-white mb-2">Глобальный API Ключ</h3>
                             <p className="text-xs text-neutral-500 mb-4">
                                Этот ключ сохранится в базе данных и будет раздаваться всем пользователям.
                             </p>
                             <div className="flex gap-2">
                                 <input 
                                    type="text" 
                                    value={manualKey}
                                    onChange={(e) => setManualKey(e.target.value)}
                                    placeholder="Вставьте рабочий ключ..."
                                    className="flex-grow bg-black border border-neutral-700 rounded p-2 text-white text-sm font-mono focus:border-amber-500 outline-none"
                                 />
                                 <button onClick={handleSaveKey} className="bg-amber-600 text-black font-bold px-3 py-2 rounded text-sm hover:bg-amber-500">
                                     Сохранить
                                 </button>
                                 {isOverride && (
                                     <button onClick={handleClearKey} className="bg-red-900/30 text-red-500 border border-red-900 font-bold px-3 py-2 rounded text-sm hover:bg-red-900/50">
                                         X
                                     </button>
                                 )}
                             </div>
                        </div>
                     </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AdminPanel;
