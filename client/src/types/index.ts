// Event (News) - from GDELT and other news sources
export interface Event {
  id: string;
  title: string;
  summary: string;
  lat: number;
  lng: number;
  timestamp: Date;
  source: string;
  sourceUrl: string;
  category: EventCategory;
  intensity: number; // 0-100
  imageUrl?: string;
  entities: string[];
  gdeltTone?: number;
  relatedEventIds: string[];
}

export type EventCategory =
  | 'conflict'
  | 'politics'
  | 'disaster'
  | 'economics'
  | 'health'
  | 'technology'
  | 'environment';

// Prediction (Polymarket)
export interface Prediction {
  marketId: string;
  question: string;
  probability: number; // 0-1
  volume: number; // USD trading volume
  endDate: Date;
  locations: PredictionLocation[];
  category: PredictionCategory;
  url: string;
  outcomes: PredictionOutcome[];
  closingSoon: boolean; // < 24h to resolution
}

export interface PredictionLocation {
  lat: number;
  lng: number;
  confidence: number; // 0-1
  name: string;
}

export interface PredictionOutcome {
  name: string;
  probability: number;
}

export type PredictionCategory =
  | 'election'
  | 'geopolitical'
  | 'disaster'
  | 'economic'
  | 'other';

// Heatmap data point
export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  eventCount: number;
  dominantCategory: string;
  h3Index: string;
}

// View modes
export type ViewMode = 'news' | 'predictions' | 'combined';

// Filter state
export interface FilterState {
  mode: ViewMode;
  timeRange: '1h' | '6h' | '24h' | '7d';
  categories: string[];
  // Prediction-specific
  minProbability: number;
  maxProbability: number;
  minVolume: number;
  closingSoon: boolean;
}

// Globe interaction state
export interface GlobeState {
  selectedEvent: Event | null;
  selectedPrediction: Prediction | null;
  hoveredLocation: { lat: number; lng: number } | null;
  cameraPosition: { x: number; y: number; z: number };
}
