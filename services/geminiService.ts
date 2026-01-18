
import { Type, Schema } from "@google/genai";
import { UserAnalysis, StyleRecommendation, AnalysisMode, Store, StylePreferences, ShoppingProduct } from "../types";
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
 * PROXY HELPER
 * Sends data to our Vercel /api/gemini-proxy endpoint.
 * This ensures the request comes from Vercel's IP (US/EU), bypassing user location blocks.
 */
const callGeminiProxy = async (model: string, contents: any, generationConfig?: any, tools?: any) => {
    const apiKey = await getOrFetchApiKey();
    
    // Construct the payload as the REST API expects it
    const payload = {
        contents: contents,
        safetySettings: SAFETY_SETTINGS,
        generationConfig: generationConfig || {},
    };

    // Add tools if present (Google Search, etc)
    if (tools) {
        (payload as any).tools = tools;
    }

    const response = await fetch('/api/gemini-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            apiKey,
            model,
            data: payload
        })
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || err.error || 'Proxy Error');
    }

    const result = await response.json();
    
    // Extract text from standard REST response structure
    // candidates[0].content.parts[0].text
    const text = result.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    
    // Return an object mimicking the SDK response for compatibility
    return {
        text,
        candidates: result.candidates
    };
};

export const analyzeUserImage = async (base64Image: string, mode: AnalysisMode = 'STANDARD'): Promise<UserAnalysis> => {
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

  let promptInstructions = "";
  if (mode === 'OBJECTIVE') {
    promptInstructions = `
      ROLE: Elite High-Fashion Stylist.
      MODE: OBJECTIVE, STRICT, CORRECTIVE.
      TASK: Analyze body proportions, face shape, and suggest corrections.
      TONE: Professional, direct, honest (Russian language).
    `;
  } else {
    promptInstructions = `
      ROLE: Personal Luxury Shopper.
      MODE: STANDARD, ENHANCING.
      TASK: Identify body type, season, and suggest enhancing styles.
      TONE: Inspiring, helpful (Russian language).
    `;
  }

  const prompt = `
    Analyze this photo.
    ${promptInstructions}
    Return JSON: gender, bodyType, seasonalColor, styleKeywords (array), detailedDescription.
  `;

  try {
    const contents = {
        parts: [
            { inlineData: { mimeType: getMimeType(base64Image), data: cleanBase64(base64Image) } },
            { text: prompt }
        ]
    };

    const generationConfig = {
        responseMimeType: "application/json",
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                gender: { type: Type.STRING },
                bodyType: { type: Type.STRING },
                seasonalColor: { type: Type.STRING },
                styleKeywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                detailedDescription: { type: Type.STRING }
            },
            required: ["gender", "bodyType", "seasonalColor", "styleKeywords", "detailedDescription"]
        }
    };

    const response = await callGeminiProxy('gemini-3-flash-preview', contents, generationConfig);

    if (response.text) return parseJSON(response.text) as UserAnalysis;
    throw new Error(`Пустой ответ от ИИ.`);
  } catch (error: any) {
    console.error("Gemini Analyze Error:", error);
    throw new Error(`Ошибка AI: ${error.message || error.toString()}`);
  }
};

export const getStyleRecommendations = async (
  analysis: UserAnalysis, 
  stores: Store[],
  preferences: StylePreferences
): Promise<StyleRecommendation[]> => {

  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    return [];
  }

  const activeStores = stores.filter(s => s.isSelected);
  const siteOperators = activeStores.length > 0 ? activeStores.map(s => `site:${s.domain}`).join(' OR ') : '';
  const storeInstruction = siteOperators ? `SEARCH INSTRUCTIONS: Search ONLY within these domains: ${activeStores.map(s => s.name).join(', ')} using query operator "(${siteOperators})".` : '';
  
  const prompt = `
    ROLE: World-Class Fashion Stylist.
    CLIENT PROFILE: ${analysis.gender}, ${analysis.bodyType}, ${analysis.seasonalColor}.
    CONTEXT: Season ${preferences.season}, Occasion ${preferences.occasion}.
    ${storeInstruction}
    TASK: Create 4 DISTINCT, COMPLETE "TOTAL LOOKS".
    RULES: 5-8 items per look. Must include Accessories.
    IMPORTANT: Provide a creative 'title' for each look in Russian.
  `;

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

  try {
      const response = await callGeminiProxy(
          'gemini-3-flash-preview', 
          { parts: [{ text: prompt }] },
          { 
              responseMimeType: "application/json",
              responseSchema: schema
          },
          [{ googleSearch: {} }] // tools
      );

      if (response.text) return parseJSON(response.text) as StyleRecommendation[];
      throw new Error("No style data returned");
  } catch (error: any) {
      console.error("Style Gen Error:", error);
      throw new Error(`Ошибка генерации стиля: ${error.message}`);
  }
};

export const findShoppingProducts = async (itemQuery: string): Promise<ShoppingProduct[]> => {
  if (IS_DEMO_MODE) return [];

  const prompt = `
    TASK: Fast Product Search. QUERY: "${itemQuery}". MARKET: Russia.
    Identify 3 POPULAR, REAL product options. Return JSON: title, price, store, imageUrl.
  `;

  try {
      const response = await callGeminiProxy(
          'gemini-3-flash-preview',
          { parts: [{ text: prompt }] },
          {}, // config
          [{ googleSearch: {} }] // tools
      );

      if (response.text) {
        const products = parseJSON(response.text) as ShoppingProduct[];
        return products.map(p => ({ ...p, url: '' }));
      }
      return [];
  } catch (error) {
      return [];
  }
};

export const editUserImage = async (base64Image: string, textPrompt: string, maskImage?: string): Promise<string> => {
  if (IS_DEMO_MODE) return base64Image;

  const model = 'gemini-2.5-flash-image';

  const parts: any[] = [
    { inlineData: { data: cleanBase64(base64Image), mimeType: getMimeType(base64Image) } }
  ];

  if (maskImage) {
    parts.push({ inlineData: { data: cleanBase64(maskImage), mimeType: 'image/png' } });
    textPrompt = `${textPrompt}. Use the second image as a mask.`;
  }
  parts.push({ text: textPrompt });

  try {
    const response = await callGeminiProxy(
        model,
        { parts: parts }
    );

    // Parse image from response candidates
    // REST API returns image bytes in inlineData
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
    throw new Error(`Ошибка редактора: ${error.message}`);
  }
};
