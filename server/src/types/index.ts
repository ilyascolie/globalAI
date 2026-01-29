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

// API response types
export interface EventsResponse {
  events: Event[];
  total: number;
  hasMore: boolean;
}

export interface PredictionsResponse {
  predictions: Prediction[];
  total: number;
  lastUpdated: Date;
}

export interface HeatmapResponse {
  points: HeatmapPoint[];
  maxIntensity: number;
  timeRange: string;
}

// Polymarket API types
export interface PolymarketMarket {
  id: string;
  question: string;
  conditionId: string;
  slug: string;
  endDate: string;
  liquidity: string;
  volume: string;
  volumeNum: number;
  outcomes: string;
  outcomePrices: string;
  active: boolean;
  closed: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  groupItemTitle?: string;
  groupItemThreshold?: string;
}

export interface PolymarketEvent {
  id: string;
  ticker: string;
  slug: string;
  title: string;
  description: string;
  startDate: string;
  endDate: string;
  image: string;
  icon: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  new: boolean;
  featured: boolean;
  restricted: boolean;
  liquidity: number;
  volume: number;
  markets: PolymarketMarket[];
}

// Geographic extraction result
export interface GeoExtraction {
  locations: ExtractedLocation[];
  confidence: number;
  method: 'nlp' | 'pattern' | 'manual';
}

export interface ExtractedLocation {
  name: string;
  lat: number;
  lng: number;
  confidence: number;
  type: 'country' | 'city' | 'region' | 'organization';
}

// Filter parameters
export interface PredictionFilters {
  minProbability?: number;
  maxProbability?: number;
  minVolume?: number;
  categories?: PredictionCategory[];
  closingSoon?: boolean;
}

export interface EventFilters {
  categories?: EventCategory[];
  since?: Date;
  bounds?: {
    north: number;
    south: number;
    east: number;
    west: number;
  };
}
