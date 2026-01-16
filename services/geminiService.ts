import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserAnalysis, StyleRecommendation, AnalysisMode, Store, StylePreferences, ShoppingProduct } from "../types";

// --- DEMO MODE CONFIGURATION ---
// Set to TRUE to use static mock data (no API costs, stable demo).
// Set to FALSE to use real Gemini AI.
export const IS_DEMO_MODE = false; 

// Helper to remove data URL prefix for API calls
const cleanBase64 = (base64: string) => base64.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, '');

// Helper to extract mime type from base64 string
const getMimeType = (base64: string) => {
  const match = base64.match(/^data:(image\/\w+);base64,/);
  return match ? match[1] : 'image/jpeg';
};

// Helper to safely parse JSON with aggressive cleaning
const parseJSON = (text: string) => {
  try {
    let cleaned = text.replace(/```json\n?|```/g, '').trim();
    if (cleaned.startsWith('json')) cleaned = cleaned.substring(4).trim();
    const firstOpen = cleaned.search(/[\{\[]/);
    const lastCloseCurly = cleaned.lastIndexOf('}');
    const lastCloseSquare = cleaned.lastIndexOf(']');
    const lastClose = Math.max(lastCloseCurly, lastCloseSquare);
    if (firstOpen !== -1 && lastClose !== -1) cleaned = cleaned.substring(firstOpen, lastClose + 1);
    try { return JSON.parse(cleaned); } catch (e) {
        // Simple manual fix for common JSON issues if standard parse fails
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
 * Analyzes the user's photo using Gemini 3 Pro (Vision)
 */
export const analyzeUserImage = async (base64Image: string, mode: AnalysisMode = 'STANDARD'): Promise<UserAnalysis> => {
  
  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate AI thinking time
    return {
      gender: "Женский",
      bodyType: "Песочные часы",
      seasonalColor: "Глубокая Осень",
      styleKeywords: ["Элегантность", "Минимализм", "Статус", "Комфорт", "Тренд"],
      detailedDescription: "[ДЕМО РЕЖИМ] Система анализа внешности. В реальной версии здесь производится расчет биометрических точек лица, определение подтона кожи и архитектуры тела. Сейчас загружен демонстрационный профиль 'Идеальный баланс', чтобы показать возможности интерфейса."
    };
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  let promptInstructions = "";

  if (mode === 'OBJECTIVE') {
    promptInstructions = `
      ROLE: Elite High-Fashion Stylist & Image Consultant.
      MODE: OBJECTIVE, STRICT, CORRECTIVE.
      TASK: Analyze body proportions, face shape, and suggest corrections.
      TONE: Professional, direct, honest, constructive (Russian language).
    `;
  } else {
    promptInstructions = `
      ROLE: Personal Luxury Shopper & Stylist.
      MODE: STANDARD, ENHANCING, STYLISH.
      TASK: Identify body type, season, and suggest enhancing styles.
      TONE: Inspiring, helpful, sophisticated (Russian language).
    `;
  }

  const prompt = `
    Analyze this photo of a person.
    ${promptInstructions}
    Return JSON: gender, bodyType, seasonalColor, styleKeywords (array), detailedDescription.
  `;

  const mimeType = getMimeType(base64Image);

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: {
      parts: [
        { inlineData: { mimeType: mimeType, data: cleanBase64(base64Image) } },
        { text: prompt }
      ]
    },
    config: {
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
    }
  });

  if (response.text) {
    return parseJSON(response.text) as UserAnalysis;
  }
  throw new Error("Не удалось проанализировать изображение");
};

/**
 * Generates style recommendations
 */
export const getStyleRecommendations = async (
  analysis: UserAnalysis, 
  stores: Store[],
  preferences: StylePreferences
): Promise<StyleRecommendation[]> => {

  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 2500));
    return [
      {
        id: "demo_1",
        title: "Old Money Aesthetic",
        description: "Образ в стиле 'тихая роскошь'. Натуральные ткани, спокойные оттенки и безупречный крой.",
        rationale: "Идеально подходит для вашего цветотипа, подчеркивая статус.",
        colorPalette: ["#F5F5DC", "#8B4513", "#FFFFFF"],
        items: [
          { name: "Кашемировый джемпер", category: "Верх", searchQuery: "кашемировый джемпер бежевый", thumbnailUrl: "https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&q=80&w=200" },
          { name: "Брюки палаццо", category: "Низ", searchQuery: "брюки палаццо коричневые", thumbnailUrl: "https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&q=80&w=200" },
          { name: "Лоферы Loro Piana style", category: "Обувь", searchQuery: "замшевые лоферы женские", thumbnailUrl: "https://images.unsplash.com/photo-1610902829283-05bf8e8c56fa?auto=format&fit=crop&q=80&w=200" }
        ]
      },
      {
        id: "demo_2",
        title: "Urban Minimalist",
        description: "Современный городской стиль. Строгие линии, монохром и акцентные аксессуары.",
        rationale: "Подчеркивает структуру фигуры 'Песочные часы'.",
        colorPalette: ["#000000", "#333333", "#808080"],
        items: [
          { name: "Оверсайз жакет", category: "Верх", searchQuery: "черный пиджак оверсайз", thumbnailUrl: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&q=80&w=200" },
          { name: "Джинсы Straight Fit", category: "Низ", searchQuery: "джинсы прямые серые", thumbnailUrl: "https://images.unsplash.com/photo-1582552938357-32b906df40cb?auto=format&fit=crop&q=80&w=200" },
          { name: "Сумка-багет", category: "Аксессуары", searchQuery: "сумка багет черная", thumbnailUrl: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=200" }
        ]
      }
    ];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

  // Define schema to guarantee title existence
  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING, description: "Creative name of the style in Russian" },
        description: { type: Type.STRING, description: "Brief description of the mood in Russian" },
        rationale: { type: Type.STRING },
        colorPalette: { type: Type.ARRAY, items: { type: Type.STRING } },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING, description: "Name of the item in Russian" },
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

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: prompt,
    config: { 
        responseMimeType: "application/json",
        responseSchema: schema,
        tools: [{ googleSearch: {} }] 
    }
  });

  if (response.text) return parseJSON(response.text) as StyleRecommendation[];
  throw new Error("Не удалось создать рекомендации");
};

/**
 * Find Products
 */
export const findShoppingProducts = async (itemQuery: string): Promise<ShoppingProduct[]> => {
  
  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 1500));
    return [
      {
        title: "Товар (Демо) - Premium",
        price: "15 990 ₽",
        store: "Lamoda",
        imageUrl: "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&q=80&w=300",
        url: ""
      },
      {
        title: "Товар (Демо) - Mid-range",
        price: "5 490 ₽",
        store: "Lime",
        imageUrl: "https://images.unsplash.com/photo-1529139574466-a302d2052574?auto=format&fit=crop&q=80&w=300",
        url: ""
      },
      {
        title: "Товар (Демо) - Budget",
        price: "2 990 ₽",
        store: "Wildberries",
        imageUrl: "https://images.unsplash.com/photo-1523381210434-271e8be1f52b?auto=format&fit=crop&q=80&w=300",
        url: ""
      }
    ];
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  const prompt = `
    TASK: Fast Product Search. QUERY: "${itemQuery}". MARKET: Russia.
    Identify 3 POPULAR, REAL product options. Return JSON: title, price, store, imageUrl.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash', 
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] }
  });

  if (response.text) {
    const products = parseJSON(response.text) as ShoppingProduct[];
    return products.map(p => ({ ...p, url: '' }));
  }
  return [];
};


/**
 * Edit User Image
 */
export const editUserImage = async (base64Image: string, textPrompt: string, maskImage?: string): Promise<string> => {
  
  if (IS_DEMO_MODE) {
    await new Promise(resolve => setTimeout(resolve, 3000));
    return "https://images.unsplash.com/photo-1483985988355-763728e1935b?q=80&w=1470&auto=format&fit=crop"; 
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const response = await ai.models.generateContent({
      model: model,
      contents: { parts },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
  } catch (error: any) {
    console.error("Gemini Image Edit Error:", error);
    throw new Error("Не удалось сгенерировать изображение.");
  }

  throw new Error("Не удалось сгенерировать изображение");
};