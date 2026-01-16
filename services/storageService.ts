import { TelegramUser, HistoryItem } from '../types';
import { supabase } from './supabaseClient';

// Fallback to localStorage if Supabase fails or keys are missing
const STORAGE_PREFIX = 'stylevision_';
const SYSTEM_USER_ID = -100; // Special ID for system config

export const storageService = {
  
  // --- USER PROFILE ---
  saveUser: async (user: TelegramUser) => {
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          first_name: user.first_name,
          last_name: user.last_name,
          username: user.username,
          photo_url: user.photo_url,
          is_guest: user.isGuest || false
        });

      if (error) throw error;
      
    } catch (e) {
      console.warn("Supabase saveUser failed, falling back to local:", e);
      localStorage.setItem(`${STORAGE_PREFIX}user_${user.id}`, JSON.stringify(user));
    }
  },

  getUser: async (userId: number): Promise<TelegramUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();
        
      if (error || !data) throw error;

      return {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          photo_url: data.photo_url,
          isGuest: data.is_guest
      };
    } catch (e) {
      const local = localStorage.getItem(`${STORAGE_PREFIX}user_${userId}`);
      return local ? JSON.parse(local) : null;
    }
  },

  // --- SUBSCRIPTION ---
  setProStatus: async (userId: number, status: boolean) => {
    try {
       const { error } = await supabase
        .from('users')
        .update({ is_pro: status })
        .eq('id', userId);
        
       if (error) throw error;
    } catch (e) {
       console.warn("Supabase setPro failed:", e);
       localStorage.setItem(`${STORAGE_PREFIX}pro_${userId}`, String(status));
    }
  },

  getProStatus: async (userId: number): Promise<boolean> => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('is_pro')
            .eq('id', userId)
            .single();

        if (error) throw error;
        return data?.is_pro || false;
    } catch (e) {
        return localStorage.getItem(`${STORAGE_PREFIX}pro_${userId}`) === 'true';
    }
  },

  // --- HISTORY & LIMITS ---
  saveHistoryItem: async (userId: number, item: HistoryItem) => {
    try {
        const { error } = await supabase
            .from('history')
            .insert({
                user_id: userId,
                original_image: item.originalImage,
                result_image: item.resultImage,
                style_title: item.styleTitle,
                analysis: item.analysis,
                recommendations: item.recommendations
            });
            
        if (error) throw error;
    } catch (e) {
       console.error("Supabase History Save Error:", e);
       const currentHistory = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}history_${userId}`) || '[]');
       const newHistory = [item, ...currentHistory].slice(0, 20);
       localStorage.setItem(`${STORAGE_PREFIX}history_${userId}`, JSON.stringify(newHistory));
    }
  },

  getHistory: async (userId: number): Promise<HistoryItem[]> => {
    try {
        const { data, error } = await supabase
            .from('history')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) throw error;

        return data.map((row: any) => ({
            id: row.id,
            date: new Date(row.created_at).toLocaleDateString('ru-RU'),
            originalImage: row.original_image,
            resultImage: row.result_image,
            styleTitle: row.style_title,
            analysis: row.analysis,
            recommendations: row.recommendations
        }));

    } catch (e) {
        const data = localStorage.getItem(`${STORAGE_PREFIX}history_${userId}`);
        return data ? JSON.parse(data) : [];
    }
  },

  getRecentGenerationsCount: async (userId: number, hours: number = 5): Promise<number> => {
    try {
      const date = new Date();
      date.setHours(date.getHours() - hours);
      const isoDate = date.toISOString();

      const { count, error } = await supabase
        .from('history')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', isoDate);

      if (error) throw error;
      return count || 0;

    } catch (e) {
      return 0; 
    }
  },

  // --- GLOBAL SYSTEM CONFIG (API KEY SHARING) ---
  saveGlobalApiKey: async (apiKey: string) => {
      try {
          // We use a special system user ID (-100) to store the API key in the 'first_name' field
          // This is a hack to use existing tables without schema migration
          const { error } = await supabase
              .from('users')
              .upsert({
                  id: SYSTEM_USER_ID,
                  first_name: apiKey, 
                  last_name: 'SYSTEM_CONFIG',
                  username: 'system_key_store',
                  is_guest: true
              });
          
          if (error) throw error;
          console.log("Global API Key saved to database");
          return true;
      } catch (e) {
          console.error("Failed to save global key:", e);
          return false;
      }
  },

  getGlobalApiKey: async (): Promise<string | null> => {
      try {
          const { data, error } = await supabase
              .from('users')
              .select('first_name')
              .eq('id', SYSTEM_USER_ID)
              .single();

          if (error) return null;
          // Validate it looks like a key
          if (data?.first_name && data.first_name.startsWith('AIza')) {
              return data.first_name;
          }
          return null;
      } catch (e) {
          return null;
      }
  },

  // --- ADMIN FUNCTIONS ---
  getAllUsers: async (): Promise<any[]> => {
     try {
         const { data, error } = await supabase
            .from('users')
            .select('*')
            .neq('id', SYSTEM_USER_ID) // Hide the system user
            .order('created_at', { ascending: false })
            .limit(50);
         
         if (error) throw error;
         
         return data.map((u: any) => ({
             id: u.id,
             first_name: u.first_name,
             last_name: u.last_name,
             username: u.username,
             photo_url: u.photo_url,
             isPro: u.is_pro,
             isGuest: u.is_guest,
             historyCount: 0 
         }));
     } catch (e) {
         const users: any[] = [];
         for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(`${STORAGE_PREFIX}user_`)) {
                const userData = JSON.parse(localStorage.getItem(key)!);
                users.push(userData);
            }
         }
         return users;
     }
  }
};