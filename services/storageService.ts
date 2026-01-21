
import { TelegramUser, HistoryItem } from '../types';
import { supabase } from './supabaseClient';

// Fallback to localStorage if Supabase fails or keys are missing
const STORAGE_PREFIX = 'stylevision_';
const SYSTEM_USER_ID = -100; // Special ID for system config storage

export interface GlobalConfig {
    price: string;
    productTitle: string;
    productDescription: string;
    maintenanceMode: boolean;
}

// Helper: Convert Base64 to Blob for upload
const base64ToBlob = (base64: string): Blob => {
  const parts = base64.split(';base64,');
  const contentType = parts[0].split(':')[1];
  const raw = window.atob(parts[1]);
  const rawLength = raw.length;
  const uInt8Array = new Uint8Array(rawLength);

  for (let i = 0; i < rawLength; ++i) {
    uInt8Array[i] = raw.charCodeAt(i);
  }

  return new Blob([uInt8Array], { type: contentType });
};

// Helper: Upload image to Supabase Storage and get URL
const uploadImageToStorage = async (userId: number, base64Image: string | null, type: 'orig' | 'res'): Promise<string | null> => {
    if (!base64Image || !base64Image.startsWith('data:')) {
        return base64Image; // Already a URL or null
    }

    try {
        const blob = base64ToBlob(base64Image);
        // Create unique filename: user_{id}/{timestamp}_{type}.png
        const filename = `user_${userId}/${Date.now()}_${type}.png`;

        const { error: uploadError } = await supabase.storage
            .from('images') // Bucket name
            .upload(filename, blob, {
                cacheControl: '3600',
                upsert: false
            });

        if (uploadError) throw uploadError;

        const { data } = supabase.storage
            .from('images')
            .getPublicUrl(filename);

        return data.publicUrl;
    } catch (e) {
        console.error("Storage Upload Error:", e);
        return base64Image; // Fallback: save Base64 string if upload fails (so we don't lose data)
    }
};

export const storageService = {
  
  // --- USER PROFILE ---
  saveUser: async (user: TelegramUser) => {
    try {
      // Prepare payload ensuring safe types
      const payload = {
          id: user.id,
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          username: user.username || '',
          photo_url: user.photo_url || '',
          is_guest: user.isGuest === true, // Ensure boolean
          terms_accepted_at: user.termsAcceptedAt || new Date().toISOString() // Ensure value exists
      };

      const { error } = await supabase
        .from('users')
        .upsert(payload, { onConflict: 'id' }); // Explicit conflict handling

      if (error) {
        console.error("Supabase Error:", error);
        throw error;
      }
      
    } catch (e) {
      console.warn("Supabase saveUser failed, falling back to local:", e);
      // Fallback save to LocalStorage
      localStorage.setItem(`${STORAGE_PREFIX}user_${user.id}`, JSON.stringify(user));
    }
  },

  getUser: async (userId: number): Promise<TelegramUser | null> => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();
        
      if (error) throw error;
      if (!data) return null; // Return null instead of throwing if simply not found

      return {
          id: data.id,
          first_name: data.first_name,
          last_name: data.last_name,
          username: data.username,
          photo_url: data.photo_url,
          isGuest: data.is_guest,
          termsAcceptedAt: data.terms_accepted_at
      };
    } catch (e) {
      // Read from LocalStorage fallback
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
            .maybeSingle();

        if (error) throw error;
        return data?.is_pro || false;
    } catch (e) {
        return localStorage.getItem(`${STORAGE_PREFIX}pro_${userId}`) === 'true';
    }
  },

  // --- HISTORY & LIMITS ---
  saveHistoryItem: async (userId: number, item: HistoryItem) => {
    try {
        // TASK 2: Architecture Fix - Upload to Storage first
        // We do this concurrently to save time
        const [originalUrl, resultUrl] = await Promise.all([
            uploadImageToStorage(userId, item.originalImage, 'orig'),
            uploadImageToStorage(userId, item.resultImage, 'res')
        ]);

        const { error } = await supabase
            .from('history')
            .insert({
                user_id: userId,
                original_image: originalUrl, // Now a short URL (or base64 fallback)
                result_image: resultUrl,     // Now a short URL (or base64 fallback)
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

  deleteHistoryItem: async (userId: number, itemId: string) => {
    try {
        const { error } = await supabase
            .from('history')
            .delete()
            .eq('id', itemId)
            .eq('user_id', userId);
            
        if (error) throw error;
        // Note: Ideally we should also delete from Storage bucket, but it's optional for now
    } catch (e) {
       console.error("Supabase History Delete Error:", e);
       // Local Storage Fallback
       const key = `${STORAGE_PREFIX}history_${userId}`;
       const currentHistory = JSON.parse(localStorage.getItem(key) || '[]');
       const newHistory = currentHistory.filter((i: any) => i.id !== itemId);
       localStorage.setItem(key, JSON.stringify(newHistory));
    }
  },

  getHistory: async (userId: number): Promise<HistoryItem[]> => {
    try {
        // TASK 1: Optimization - Explicit Column Selection
        // Only fetch columns we actually need. Since we now use URLs (mostly), this is fast.
        // Even if old records are Base64, explicit selection is better than '*'
        const { data, error } = await supabase
            .from('history')
            .select('id, created_at, original_image, result_image, style_title, analysis, recommendations')
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

      // Optimize count query to simple head request
      const { count, error } = await supabase
        .from('history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', isoDate);

      if (error) throw error;
      return count || 0;

    } catch (e) {
      return 0; 
    }
  },

  // --- GLOBAL SYSTEM CONFIG ---
  
  saveGlobalApiKey: async (apiKey: string) => {
      try {
          const { error } = await supabase
            .from('users')
            .upsert({
                 id: SYSTEM_USER_ID,
                 first_name: apiKey,
                 username: 'SYSTEM_CONFIG',
                 is_guest: true
            });
            
          if (error) throw error;
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
            .maybeSingle();
            
          if (error || !data) return null;
          return data.first_name || null;
      } catch (e) {
          console.error("Failed to get global key:", e);
          return null;
      }
  },

  saveGlobalConfig: async (config: GlobalConfig) => {
    try {
        const currentKey = await storageService.getGlobalApiKey();
        
        const { error } = await supabase
          .from('users')
          .upsert({
               id: SYSTEM_USER_ID,
               first_name: currentKey || '', 
               last_name: JSON.stringify(config), 
               username: 'SYSTEM_CONFIG',
               is_guest: true
          });
          
        if (error) throw error;
        return true;
    } catch (e) {
        console.error("Failed to save global config:", e);
        return false;
    }
  },

  getGlobalConfig: async (): Promise<GlobalConfig> => {
    const defaultConfig: GlobalConfig = {
        price: "1.00",
        productTitle: "StyleVision PRO",
        productDescription: "Неограниченный доступ ко всем функциям",
        maintenanceMode: false
    };

    try {
        const { data, error } = await supabase
          .from('users')
          .select('last_name')
          .eq('id', SYSTEM_USER_ID)
          .maybeSingle();
          
        if (error || !data || !data.last_name) return defaultConfig;
        
        try {
            const parsed = JSON.parse(data.last_name);
            return { ...defaultConfig, ...parsed };
        } catch {
            return defaultConfig;
        }
    } catch (e) {
        return defaultConfig;
    }
  },

  // --- ADMIN FUNCTIONS ---
  getAllUsers: async (): Promise<any[]> => {
     try {
         // Optimized admin list select
         const { data, error } = await supabase
            .from('users')
            .select('id, first_name, last_name, username, photo_url, is_pro, is_guest')
            .neq('id', SYSTEM_USER_ID)
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
