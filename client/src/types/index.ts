// Export types from other files
export * from './events';
export * from './context';

// Re-export common types for convenience
import type { Event, EventCategory, HeatmapPoint as BaseHeatmapPoint } from './events';

// Time range options for filtering
export type TimeRange = '1h' | '6h' | '24h' | '7d';

// View modes for the application
export type ViewMode = 'news' | 'predictions' | 'combined';

// Extended heatmap point with additional fields for visualization
export interface ExtendedHeatmapPoint extends BaseHeatmapPoint {
  events: Event[]; // Events in this cell
  decayedIntensity: number; // After temporal decay applied
}

// Prediction (Polymarket)
export interface Prediction {
  marketId: string;
  question: string;
  probability: number; // 0-1 range
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

// Hot spot region with aggregated data
export interface HotSpot {
  name: string;
  lat: number;
  lng: number;
  totalIntensity: number;
  eventCount: number;
  dominantCategory: EventCategory;
  h3Index: string;
}

// Heatmap configuration
export interface HeatmapConfig {
  radius: number; // Point radius in degrees
  intensityFalloff: number; // Falloff exponent
  opacity: number; // Global opacity 0-1
  sensitivity: number; // Intensity multiplier
  showPulse: boolean; // Pulse animation on new events
  colorGradient: HeatmapColorStop[];
}

// Color stop for gradient
export interface HeatmapColorStop {
  position: number; // 0-1
  color: [number, number, number]; // RGB 0-1
}

// Filter state
export interface FilterState {
  mode: ViewMode;
  timeRange: TimeRange;
  categories: Set<EventCategory>;
  minIntensity: number;
  // Prediction-specific
  minProbability: number;
  maxProbability: number;
  minVolume: number;
  closingSoon: boolean;
}

// Globe camera state
export interface CameraState {
  lat: number;
  lng: number;
  altitude: number; // Distance from center
}

// Animation state for time-lapse mode
export interface TimeLapseState {
  isPlaying: boolean;
  currentTime: Date;
  startTime: Date;
  endTime: Date;
  speed: number; // Multiplier
}

// Shader uniforms for heatmap
export interface HeatmapUniforms {
  uDataTexture: { value: THREE.DataTexture | null };
  uColorRamp: { value: Float32Array };
  uOpacity: { value: number };
  uTime: { value: number };
  uPulsePositions: { value: Float32Array };
  uPulseCount: { value: number };
  uPulseIntensities: { value: Float32Array };
}

// Type declaration for THREE namespace
declare global {
  namespace THREE {
    class DataTexture extends Texture {
      constructor(
        data?: BufferSource | null,
        width?: number,
        height?: number,
        format?: PixelFormat,
        type?: TextureDataType
      );
      readonly isDataTexture: true;
    }
    class Texture {
      needsUpdate: boolean;
    }
    type PixelFormat = number;
    type TextureDataType = number;
  }
}

// GLSL shader module declarations
declare module '*.glsl' {
  const content: string;
  export default content;
}
