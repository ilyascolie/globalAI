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
