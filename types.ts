
export interface ClothingItem {
  name: string;
  category: string;
  searchQuery: string;
  thumbnailUrl?: string; // New: Image Search Grounding result
}

export interface ShoppingProduct {
  title: string;
  price: string;
  store: string;
  imageUrl?: string;
  url: string;
}

export interface StyleRecommendation {
  id: string;
  title: string;
  description: string;
  rationale: string;
  items: ClothingItem[];
  colorPalette: string[];
}

export interface UserAnalysis {
  gender: string;
  bodyType: string;
  seasonalColor: string;
  styleKeywords: string[];
  detailedDescription: string;
}

export enum AppState {
  UPLOAD = 'UPLOAD',
  PREVIEW = 'PREVIEW',
  PAYMENT = 'PAYMENT',
  ANALYZING = 'ANALYZING',
  RESULTS = 'RESULTS',
}

export type AnalysisMode = 'STANDARD' | 'OBJECTIVE';

export type Season = 'ANY' | 'SPRING_SUMMER' | 'AUTUMN_WINTER';
export type Occasion = 'CASUAL' | 'BUSINESS' | 'EVENT' | 'SPORT' | 'HOME';

export interface StylePreferences {
  season: Season;
  occasion: Occasion;
}

export interface Store {
  id: string;
  name: string;
  domain: string;
  logoUrl: string;
  isSelected: boolean;
}

export interface HistoryItem {
  id: string;
  date: string;
  originalImage: string;
  resultImage: string | null;
  styleTitle: string;
  // Added fields to restore full state
  analysis?: UserAnalysis;
  recommendations?: StyleRecommendation[];
}

// Mobile Tab State
export type MobileTab = 'STUDIO' | 'COLLECTION';

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  isGuest?: boolean; // New flag
}