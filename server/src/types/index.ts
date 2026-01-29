export type EventCategory =
  | 'conflict'
  | 'politics'
  | 'disaster'
  | 'economics'
  | 'health'
  | 'technology'
  | 'environment';

export interface NewsEvent {
  id: string;
  title: string;
  summary: string;
  lat: number;
  lng: number;
  timestamp: Date;
  source: string;
  category: EventCategory;
  intensity: number;
  url: string;
  imageUrl?: string;
  gdeltTone?: number;
  sourceCount?: number;
  entities?: string[];
  relatedEventIds?: string[];
}

export interface RawNewsItem {
  title: string;
  summary?: string;
  url: string;
  timestamp: Date;
  source: string;
  imageUrl?: string;
  location?: {
    lat?: number;
    lng?: number;
    name?: string;
  };
  gdeltTone?: number;
  themes?: string[];
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  displayName: string;
  confidence: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  eventCount: number;
  dominantCategory: EventCategory;
}

export interface BoundingBox {
  lat1: number;
  lng1: number;
  lat2: number;
  lng2: number;
}

export interface EventsQuery {
  bounds?: BoundingBox;
  since?: Date;
  categories?: EventCategory[];
  limit?: number;
  offset?: number;
}

export interface HeatmapQuery {
  resolution: 'low' | 'medium' | 'high';
  timeRange?: '1h' | '6h' | '24h' | '7d';
  categories?: EventCategory[];
}

export interface CategorySummary {
  category: EventCategory;
  count: number;
  avgIntensity: number;
}

export interface DataSource {
  name: string;
  fetch(): Promise<RawNewsItem[]>;
  isAvailable(): Promise<boolean>;
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  retryAfterMs?: number;
}

// Prediction (Polymarket) types
export type PredictionCategory =
  | 'election'
  | 'geopolitical'
  | 'disaster'
  | 'economic'
  | 'other';

export interface Prediction {
  marketId: string;
  question: string;
  probability: number;
  volume: number;
  endDate: Date;
  locations: PredictionLocation[];
  category: PredictionCategory;
  url: string;
  outcomes: PredictionOutcome[];
  closingSoon: boolean;
}

export interface PredictionLocation {
  lat: number;
  lng: number;
  confidence: number;
  name: string;
}

export interface PredictionOutcome {
  name: string;
  probability: number;
}

export interface PredictionFilters {
  minProbability?: number;
  maxProbability?: number;
  minVolume?: number;
  categories?: PredictionCategory[];
  closingSoon?: boolean;
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
