// Event types for the global news visualization

export type EventCategory =
  | 'conflict'
  | 'politics'
  | 'disaster'
  | 'economics'
  | 'health'
  | 'technology'
  | 'environment';

export interface GeoLocation {
  lat: number;
  lng: number;
}

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
  thumbnailUrl?: string;
  entities: string[]; // Extracted people, organizations, places
  gdeltTone?: number; // GDELT sentiment score
  relatedEventIds: string[];
}

export interface EventCluster {
  id: string;
  h3Index: string;
  centerLat: number;
  centerLng: number;
  events: Event[];
  totalIntensity: number;
  dominantCategory: EventCategory;
  eventCount: number;
}

export interface HeatmapPoint {
  lat: number;
  lng: number;
  intensity: number;
  eventCount: number;
  dominantCategory: EventCategory;
  h3Index: string;
}

// Click interaction types
export interface ClickPosition {
  screenX: number;
  screenY: number;
  lat: number;
  lng: number;
}

export interface GlobeInteraction {
  type: 'tap' | 'drag' | 'pinch';
  startPosition: ClickPosition;
  endPosition?: ClickPosition;
  duration: number;
  distance: number;
}

export type SortOption = 'recency' | 'intensity' | 'category';

export interface EventSelection {
  type: 'single' | 'cluster';
  event?: Event;
  cluster?: EventCluster;
  position: GeoLocation;
}
