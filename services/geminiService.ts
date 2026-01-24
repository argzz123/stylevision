
import { Type, Schema } from "@google/genai";
import { UserAnalysis, StyleRecommendation, AnalysisMode, Store, StylePreferences, ShoppingProduct, UserProfilePreferences } from "../types";
import { storageService } from "./storageService";

// --- DEMO MODE CONFIGURATION ---
export const IS_DEMO_MODE = false; 

// Helper to remove data URL prefix for API calls
const cleanBase64 = (base64: string) => base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

// Helper to extract mime type from base64 string
const getMimeType = (base64: string) => {
  const match = base64.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/jpeg';
};

// --- IMAGE COMPRESSION & CONVERSION UTILITY ---
const compressImage = (imageSource: string, maxWidth = 1024, quality = 0.8): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    // CRITICAL FIX: Allow loading images from Supabase Storage (cross-origin)
    // to draw them on canvas and convert back to Base64 for Gemini API
    img.crossOrigin = "Anonymous"; 
    img.src = imageSource;
    
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions
      if (width > height) {
        if (width > maxWidth) {
          height *= maxWidth / width;
          width = maxWidth;
        }
      } else {
        if (height > maxWidth) {
          width *= maxWidth / height;
          height = maxWidth;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          // Always convert to JPEG for efficiency
          // This also converts URL -> Base64 string
          try {
             const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
             resolve(compressedDataUrl);
          } catch (e) {
             console.error("Canvas export failed (CORS?)", e);
             // Fallback: return original if canvas fails, though API might reject URL
             resolve(imageSource);
          }
      } else {
          resolve(imageSource);
      }
    };
    img.onerror = (e) => {
       console.error("Image load failed", e);
       resolve(imageSource);
    };
  });
};

// Helper to safely parse JSON
const parseJSON = (text: string) => {
  try {
    let cleaned = text.replace(/```json\n?|```/g, '').trim();
    if (cleaned.startsWith('json')) cleaned = cleaned.substring(4).trim();
    
    const firstOpen = cleaned.search(/[\{\[]/);
    if (firstOpen === -1) throw new Error("No JSON object found");
    
    const lastCloseCurly = cleaned.lastIndexOf('}');
    const lastCloseSquare = cleaned.lastIndexOf(']');
    const lastClose = Math.max(lastCloseCurly, lastCloseSquare);
    
    if (lastClose !== -1) {
        cleaned = cleaned.substring(firstOpen, lastClose + 1);
    }

    try { return JSON.parse(cleaned); } catch (e) {
        let fixed = '';
        let inQuotes = false;
        let isEscaped = false;
        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            if (char === '"' && !isEscaped) inQuotes = !inQuotes;
            if (char === '\\' && !isEscaped) { isEscaped = true; fixed += char; continue; }
            if (inQuotes) {
                if (char === '\n') fixed += '\\n';
                else if (char === '\r') {}
                else if (char === '\t') fixed += '\\t';
                else fixed += char;
            } else fixed += char;
            isEscaped = false;
        }
        return JSON.parse(fixed);
    }
  } catch (e) {
    console.error("Failed to parse JSON:", text);
    throw new Error("Invalid JSON response from AI");
  }
};

/**
 * ERROR MAPPING UTILITY
 */
const mapFriendlyError = (error: any): Error => {
    const msg = (error.message || '').toLowerCase();
    
    if (msg.includes('overloaded') || msg.includes('503')) {
        return new Error("Высокая нагрузка. Мы попытались встать в очередь, но время ожидания слишком велико. Попробуйте через минуту.");
    }
    if (msg.includes('safety') || msg.includes('blocked')) {
        return new Error("ИИ посчитал изображение или запрос небезопасным (NSFW/Safety Filter). Попробуйте другое фото.");
    }
    if (msg.includes('quota') || msg.includes('429')) {
        return new Error("Превышен лимит запросов к API. Подождите немного.");
    }
    if (msg.includes('payload too large') || msg.includes('413')) {
        return new Error("Фото слишком большое для обработки. Мы попробовали его сжать, но не вышло. Попробуйте другое фото.");
    }
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
        return new Error("Ошибка сети. Возможно, файл слишком тяжелый или интернет нестабилен.");
    }
    if (msg.includes('no human') || msg.includes('на фото не найден')) {
        return new Error("На фото не найден человек. Загрузите четкое фото в полный рост или портрет.");
    }
    
    // Default Fallback
    console.error("Unknown Error caught:", msg);
    return new Error("Упс! ИИ задумался и не выдал результат. Попробуйте еще раз.");
};

/**
 * SECURE API KEY ACCESS
 */
export const getOrFetchApiKey = async (): Promise<string> => {
    // 1. Admin Override (Local Storage)
    const localKey = localStorage.getItem('stylevision_api_key_override');
    if (localKey && localKey.startsWith('AIza')) {
        return localKey;
    }

    // 2. Database Fetch
    const globalKey = await storageService.getGlobalApiKey();
    if (globalKey && globalKey.startsWith('AIza')) {
        return globalKey;
    }

    throw new Error("API Key is missing. Please ask Admin to configure it in Panel.");
};

export const getApiKeySync = () => {
    return localStorage.getItem('stylevision_api_key_override') || '';
}

const SAFETY_SETTINGS = [
  { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
  { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
];

/**
 * RETRY LOGIC & PROXY HELPER
 */
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callGeminiProxy = async (
    model: string, 
    contents: any, 
    generationConfig?: any, 
    tools?: any,
    onStatusUpdate?: (msg: string) => void
) => {
    const apiKey = await getOrFetchApiKey();
    
    const payload = {
        contents: contents,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: generationConfig || {},
    };

    if (tools) {
        (payload as any).tools = tools;
    }

    const MAX_RETRIES = 6;
    let attempt = 0;

    while (attempt < MAX_RETRIES) {
        try {
            const response = await fetch('https://stylevision.vercel.app/api/gemini-proxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    apiKey,
                    model,
                    data: payload
                })
            });

            if (!response.ok) {
                if (response.status === 413) {
                    throw new Error("Payload Too Large (413). Image is too big.");
                }
                
                let errMsg = 'Proxy Error';
                try {
                    const err = await response.json();
                    errMsg = err.error?.message || err.error || 'Proxy Error';
                } catch (e) {
                    errMsg = `Server Error (${response.status})`;
                }
                throw new Error(errMsg);
            }

            const result = await response.json();
            const text = result.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
            
            return {
                text,
                candidates: result.candidates
            };

        } catch (error: any) {
            attempt++;
            const isOverloaded = error.message?.toLowerCase().includes('overloaded') || error.message?.includes('503');

            if (isOverloaded && attempt < MAX_RETRIES) {
                const waitTime = attempt * 5; 
                if (onStatusUpdate) {
                    onStatusUpdate(`Сервер загружен. Вы в очереди... (Попытка ${attempt}/${MAX_RETRIES}). Ожидание ~${waitTime}с`);
                }
                await wait(waitTime * 1000);
                continue; 
            }

            if (attempt === MAX_RETRIES) {
                throw error;
            }
            
            if (!isOverloaded && attempt < 2) {
                 await wait(1000);
                 continue;
            }
            
            throw error;
        }
    }
    throw new Error("Connection failed after retries");
};

export const analyzeUserImage = async (
    base64Image: string, 
    mode: AnalysisMode = 'STANDARD',
    onStatusUpdate?: (msg: string) => void
): Promise<UserAnalysis> => {
  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return {
      gender: "Женский",
      bodyType: "Песочные часы",
      seasonalColor: "Глубокая Осень",
      styleKeywords: ["Элегантность", "Минимализм", "Статус", "Комфорт", "Тренд"],
      detailedDescription: "[ДЕМО] Демонстрационный режим."
    };
  }

  // NOTE: We do not overwrite status here to "Optimization"
  // We compress silently, or let the caller set "Analyzing..."
  const compressedImage = await compressImage(base64Image, 1024, 0.75);

  let promptInstructions = "";
  if (mode === 'OBJECTIVE') {
    promptInstructions = `
      MODE: OBJECTIVE, TECHNICAL.
      TASK: Analyze body geometry and visual characteristics accurately.
      TONE: Professional, neutral, respectful (Russian language).
    `;
  } else {
    promptInstructions = `
      MODE: ENHANCING, STYLISTIC.
      TASK: Identify features to create the best style recommendations.
      TONE: Inspiring, helpful (Russian language).
    `;
  }

  const prompt = `
    Analyze this image carefully.
    
    STEP 1: CHECK FOR HUMAN.
    Is there a clear person in this photo (full body, half body, or selfie)?
    If NO human is found, return JSON: { "error": "NO_HUMAN" }.
    
    STEP 2: IF HUMAN IS FOUND, ANALYZE.
    ${promptInstructions}
    
    Return JSON with fields: 
    - gender (Male/Female/Unisex string in Russian)
    - bodyType (String in Russian)
    - seasonalColor (String in Russian)
    - styleKeywords (Array of 5 strings)
    - detailedDescription (Short paragraph in Russian describing the person)
  `;

  try {
    const contents = {
        parts: [
            { inlineData: { mimeType: 'image/jpeg', data: cleanBase64(compressedImage) } },
            { text: prompt }
        ]
    };

    const generationConfig = {
        responseMimeType: "application/json"
    };

    const response = await callGeminiProxy(
        'gemini-3-flash-preview', 
        contents, 
        generationConfig, 
        undefined, 
        onStatusUpdate
    );

    if (response.text) {
        const result = parseJSON(response.text);
        
        if (result.error === 'NO_HUMAN' || result.error === 'no_human') {
            throw new Error("На фото не найден человек");
        }
        
        return {
            gender: result.gender || "Унисекс",
            bodyType: result.bodyType || "Стандартный",
            seasonalColor: result.seasonalColor || "Контрастный",
            styleKeywords: result.styleKeywords || ["Кэжуал", "Стиль"],
            detailedDescription: result.detailedDescription || "Анализ завершен успешно."
        };
    }
    throw new Error(`Пустой ответ от ИИ.`);
  } catch (error: any) {
    console.error("Gemini Analyze Error:", error);
    throw mapFriendlyError(error);
  }
};

export const getStyleRecommendations = async (
  analysis: UserAnalysis, 
  stores: Store[],
  preferences: StylePreferences,
  onStatusUpdate?: (msg: string) => void,
  userProfile?: UserProfilePreferences
): Promise<StyleRecommendation[]> => {

  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    return [];
  }

  const activeStores = stores.filter(s => s.isSelected);
  const storeNames = activeStores.length > 0 ? activeStores.map(s => s.name).join(', ') : 'Popular Fashion Stores';
  
  // -- PROFILE INJECTION START --
  let profileContext = "";
  if (userProfile) {
      if (userProfile.favoriteStyles && userProfile.favoriteStyles.trim()) {
          profileContext += `\nUSER FAVORITES/PREFERENCES: ${userProfile.favoriteStyles}\n`;
      }
      if (userProfile.taboos && userProfile.taboos.trim()) {
          profileContext += `\nUSER TABOOS (DO NOT SUGGEST): ${userProfile.taboos}\n`;
      }
  }
  // -- PROFILE INJECTION END --

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        rationale: { type: Type.STRING },
        colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING },
              searchQuery: { type: Type.STRING }
            },
            required: ["name", "category"]
          }
        }
      },
      required: ["id", "title", "description", "colorPalette", "items"]
    }
  };

  const attemptGeneration = async (prompt: string) => {
      const response = await callGeminiProxy(
          'gemini-3-flash-preview', 
          { parts: [{ text: prompt }] },
          { 
              responseMimeType: "application/json",
              responseSchema: schema
          },
          [{ googleSearch: {} }],
          onStatusUpdate 
      );
      if (response.text) return parseJSON(response.text) as StyleRecommendation[];
      throw new Error("No style data returned");
  };

  try {
      const prompt = `
        ROLE: Professional AI Stylist.
        CLIENT: ${analysis.gender}, ${analysis.bodyType}, ${analysis.seasonalColor}.
        REQUEST: Create 4 stylish TOTAL LOOKS for Season: ${preferences.season}, Occasion: ${preferences.occasion}.
        ${profileContext}
        
        CRITICAL INSTRUCTION:
        - You MUST return 4 distinct looks.
        - If exact matches are hard to find, suggest generally available items fitting the style.
        - Target Stores: ${storeNames} (preferred but not limited to).
        - STRICTLY RESPECT TABOOS: Do not suggest items listed in the "User Taboos" section if provided.
        - INCORPORATE FAVORITES: Try to align with "User Favorites" if they fit the occasion.
        - Language: Russian.
        
        OUTPUT FORMAT: JSON Array matching the schema exactly.
        Generate IDs as 'style_1', 'style_2' etc.
      `;
      return await attemptGeneration(prompt);

  } catch (error: any) {
      console.warn("Primary generation failed, using fallback...", error);
      
      try {
          if (onStatusUpdate) onStatusUpdate("Уточняем детали стиля (повторная генерация)...");
          
          const safePrompt = `
            Task: Create 4 generic fashion outfits for ${analysis.gender} suitable for ${preferences.occasion}.
            Language: Russian.
            ${profileContext}
            Return JSON Array matching schema.
            Do not use search tools, just use your fashion knowledge.
          `;
          
          const response = await callGeminiProxy(
            'gemini-3-flash-preview',
            { parts: [{ text: safePrompt }] },
            { responseMimeType: "application/json", responseSchema: schema },
            undefined,
            onStatusUpdate
          );
          
          if (response.text) return parseJSON(response.text) as StyleRecommendation[];
          throw new Error("Fallback failed");

      } catch (retryError: any) {
          throw mapFriendlyError(retryError);
      }
  }
};

export const editUserImage = async (
    base64Image: string, 
    textPrompt: string, 
    maskImage?: string,
    onStatusUpdate?: (msg: string) => void
): Promise<string> => {
  if (IS_DEMO_MODE) return base64Image;

  const model = 'gemini-2.5-flash-image';

  // NOTE: We silently compress/convert URL to base64 here. 
  // We do not change the status message to "Optimizing" to keep UI consistent.
  const compressedImage = await compressImage(base64Image, 1024, 0.85);

  const parts: any[] = [
    { inlineData: { data: cleanBase64(compressedImage), mimeType: 'image/jpeg' } }
  ];

  if (maskImage) {
    const compressedMask = await compressImage(maskImage, 1024, 0.85);
    parts.push({ inlineData: { data: cleanBase64(compressedMask), mimeType: 'image/jpeg' } });
    textPrompt = `${textPrompt}. Use the second image as a mask.`;
  }
  parts.push({ text: textPrompt });

  try {
    const response = await callGeminiProxy(
        model,
        { parts: parts },
        undefined,
        undefined,
        onStatusUpdate
    );

    for (const candidate of response.candidates || []) {
        for (const part of candidate.content.parts || []) {
            if (part.inlineData) {
                return `data:image/png;base64,${part.inlineData.data}`;
            }
        }
    }
    throw new Error("No image data in response");
  } catch (error: any) {
    console.error("Gemini Image Edit Error:", error);
    throw mapFriendlyError(error);
  }
};
