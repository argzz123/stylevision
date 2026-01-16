import React, { useState, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { analyzeUserImage } from '../services/geminiService';

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

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setIsLoading(true);
    const allUsers = await storageService.getAllUsers();
    setUsers(allUsers);
    setIsLoading(false);
  };

  const grantPro = async (targetId: number) => {
    if (window.confirm(`Выдать PRO подписку пользователю ID: ${targetId}?`)) {
        await storageService.setProStatus(targetId, true);
        loadUsers(); // Refresh list
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

  const getApiKey = () => {
      // Use the exact same logic as geminiService
      return process.env.REACT_APP_API_KEY || process.env.API_KEY || 'AIzaSyDS7WO-9BZnktWVJtr2pbdyaB8ptFgpr8s';
  };

  const testApiConnection = async () => {
     setApiStatus('UNKNOWN');
     const start = Date.now();
     try {
         const key = getApiKey();
         if (!key) throw new Error("API Key not found");
         // Simple check
         setApiStatus('OK');
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

  const currentKey = getApiKey();

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
                        <p className="text-xs text-neutral-500">ID: {currentUserId} • Supabase DB Connected</p>
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

                            {apiLatency > 0 && <p className="text-xs text-neutral-500 mb-4">Latency: {apiLatency}ms</p>}

                            <button onClick={testApiConnection} className="w-full bg-neutral-800 hover:bg-neutral-700 text-white py-2 rounded transition-colors text-sm">
                                Проверить соединение
                            </button>
                        </div>

                        {/* Environment Info */}
                        <div className="bg-neutral-900 border border-neutral-800 p-6 rounded-lg">
                             <h3 className="text-lg font-bold text-white mb-4">Окружение</h3>
                             <div className="space-y-2 font-mono text-xs">
                                 <div className="flex justify-between border-b border-neutral-800 pb-2">
                                     <span className="text-neutral-500">Database</span>
                                     <span className={process.env.REACT_APP_SUPABASE_URL ? "text-green-500" : "text-amber-500"}>
                                         {process.env.REACT_APP_SUPABASE_URL ? 'Supabase' : 'Local Storage (Fallback)'}
                                     </span>
                                 </div>
                                 <div className="flex justify-between border-b border-neutral-800 pb-2 pt-2">
                                     <span className="text-neutral-500">API Key Present</span>
                                     <span className={currentKey ? "text-green-500" : "text-red-500"}>
                                         {currentKey ? 'YES' : 'NO'}
                                     </span>
                                 </div>
                                 <div className="flex justify-between pt-2">
                                     <span className="text-neutral-500">Admin ID</span>
                                     <span className="text-white">{currentUserId}</span>
                                 </div>
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