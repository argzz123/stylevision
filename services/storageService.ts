import { TelegramUser, HistoryItem } from '../types';
import { supabase } from './supabaseClient';

// Fallback to localStorage if Supabase fails or keys are missing
const STORAGE_PREFIX = 'stylevision_';

export const storageService = {
  
  // --- USER PROFILE ---
  // Upsert user: Create if not exists, update if exists
  saveUser: async (user: TelegramUser) => {
    try {
      // 1. Try Supabase
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

  // --- HISTORY (WARDROBE) & LIMITS ---
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
       // Fallback local
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

  // Check how many generations (history items) created in the last X hours
  getRecentGenerationsCount: async (userId: number, hours: number = 5): Promise<number> => {
    try {
      // Calculate timestamp X hours ago
      const date = new Date();
      date.setHours(date.getHours() - hours);
      const isoDate = date.toISOString();

      const { count, error } = await supabase
        .from('history')
        .select('*', { count: 'exact', head: true }) // head: true means don't return data, just count
        .eq('user_id', userId)
        .gte('created_at', isoDate);

      if (error) throw error;
      return count || 0;

    } catch (e) {
      console.warn("Could not fetch limit count from DB, assuming 0 for fallback safety", e);
      return 0; 
    }
  },

  // --- ADMIN FUNCTIONS ---
  getAllUsers: async (): Promise<any[]> => {
     try {
         const { data, error } = await supabase
            .from('users')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50); // Limit to prevent massive loads
         
         if (error) throw error;
         
         // Map DB fields to app format
         return data.map((u: any) => ({
             id: u.id,
             first_name: u.first_name,
             last_name: u.last_name,
             username: u.username,
             photo_url: u.photo_url,
             isPro: u.is_pro,
             isGuest: u.is_guest,
             // We'd need a separate join or query for history count, 
             // but for now we'll leave it as 0 or do a quick fetch if critical
             historyCount: 0 
         }));
     } catch (e) {
         console.error("Admin fetch error", e);
         // Fallback to local storage mock
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