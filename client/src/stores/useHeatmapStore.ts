import { create } from 'zustand';
import type {
  Event,
  HeatmapPoint,
  HotSpot,
  EventCategory,
  TimeRange,
  FilterState,
  HeatmapConfig,
  TimeLapseState,
} from '../types';

interface PulseEvent {
  lat: number;
  lng: number;
  intensity: number;
  startTime: number;
}

interface HeatmapState {
  // Raw events data
  events: Event[];
  setEvents: (events: Event[]) => void;
  addEvent: (event: Event) => void;

  // Processed heatmap points (after H3 binning)
  heatmapPoints: HeatmapPoint[];
  setHeatmapPoints: (points: HeatmapPoint[]) => void;

  // Hot spots (top active regions)
  hotSpots: HotSpot[];
  setHotSpots: (spots: HotSpot[]) => void;

  // Filters
  filters: FilterState;
  setTimeRange: (range: TimeRange) => void;
  toggleCategory: (category: EventCategory) => void;
  setMinIntensity: (intensity: number) => void;

  // Heatmap configuration
  config: HeatmapConfig;
  setOpacity: (opacity: number) => void;
  setSensitivity: (sensitivity: number) => void;
  setRadius: (radius: number) => void;
  togglePulse: (enabled: boolean) => void;

  // Pulse animations for new events
  pulseEvents: PulseEvent[];
  addPulseEvent: (lat: number, lng: number, intensity: number) => void;
  clearExpiredPulses: () => void;

  // Time-lapse mode
  timeLapse: TimeLapseState;
  setTimeLapsePlaying: (playing: boolean) => void;
  setTimeLapseTime: (time: Date) => void;
  setTimeLapseSpeed: (speed: number) => void;
  setTimeLapseRange: (start: Date, end: Date) => void;

  // Data texture for shader
  dataTexture: Float32Array | null;
  setDataTexture: (texture: Float32Array) => void;

  // Loading states
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;

  // Selected event
  selectedEventId: string | null;
  setSelectedEventId: (id: string | null) => void;
}

// Default color gradient: blue -> cyan -> yellow -> orange -> red
const defaultColorGradient = [
  { position: 0.0, color: [0.0, 0.2, 0.8] as [number, number, number] },
  { position: 0.25, color: [0.0, 0.7, 0.9] as [number, number, number] },
  { position: 0.5, color: [1.0, 0.9, 0.0] as [number, number, number] },
  { position: 0.75, color: [1.0, 0.5, 0.0] as [number, number, number] },
  { position: 1.0, color: [1.0, 0.0, 0.0] as [number, number, number] },
];

// All event categories
const allCategories = new Set<EventCategory>([
  'conflict',
  'politics',
  'disaster',
  'economics',
  'health',
  'technology',
  'environment',
]);

export const useHeatmapStore = create<HeatmapState>((set, get) => ({
  // Events
  events: [],
  setEvents: (events) => set({ events }),
  addEvent: (event) => {
    set((state) => ({ events: [...state.events, event] }));
    // Trigger pulse animation for new event
    get().addPulseEvent(event.lat, event.lng, event.intensity);
  },

  // Heatmap points
  heatmapPoints: [],
  setHeatmapPoints: (points) => set({ heatmapPoints: points }),

  // Hot spots
  hotSpots: [],
  setHotSpots: (spots) => set({ hotSpots: spots }),

  // Filters
  filters: {
    timeRange: '24h',
    categories: new Set(allCategories),
    minIntensity: 0,
  },
  setTimeRange: (timeRange) =>
    set((state) => ({ filters: { ...state.filters, timeRange } })),
  toggleCategory: (category) =>
    set((state) => {
      const categories = new Set(state.filters.categories);
      if (categories.has(category)) {
        categories.delete(category);
      } else {
        categories.add(category);
      }
      return { filters: { ...state.filters, categories } };
    }),
  setMinIntensity: (minIntensity) =>
    set((state) => ({ filters: { ...state.filters, minIntensity } })),

  // Config
  config: {
    radius: 1.5,
    intensityFalloff: 2.0,
    opacity: 0.7,
    sensitivity: 1.0,
    showPulse: true,
    colorGradient: defaultColorGradient,
  },
  setOpacity: (opacity) =>
    set((state) => ({ config: { ...state.config, opacity } })),
  setSensitivity: (sensitivity) =>
    set((state) => ({ config: { ...state.config, sensitivity } })),
  setRadius: (radius) =>
    set((state) => ({ config: { ...state.config, radius } })),
  togglePulse: (showPulse) =>
    set((state) => ({ config: { ...state.config, showPulse } })),

  // Pulse events
  pulseEvents: [],
  addPulseEvent: (lat, lng, intensity) =>
    set((state) => ({
      pulseEvents: [
        ...state.pulseEvents,
        { lat, lng, intensity: intensity / 100, startTime: Date.now() / 1000 },
      ].slice(-10), // Keep only last 10 pulses
    })),
  clearExpiredPulses: () =>
    set((state) => ({
      pulseEvents: state.pulseEvents.filter(
        (p) => Date.now() / 1000 - p.startTime < 3
      ),
    })),

  // Time-lapse
  timeLapse: {
    isPlaying: false,
    currentTime: new Date(),
    startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 24h ago
    endTime: new Date(),
    speed: 1,
  },
  setTimeLapsePlaying: (isPlaying) =>
    set((state) => ({ timeLapse: { ...state.timeLapse, isPlaying } })),
  setTimeLapseTime: (currentTime) =>
    set((state) => ({ timeLapse: { ...state.timeLapse, currentTime } })),
  setTimeLapseSpeed: (speed) =>
    set((state) => ({ timeLapse: { ...state.timeLapse, speed } })),
  setTimeLapseRange: (startTime, endTime) =>
    set((state) => ({
      timeLapse: { ...state.timeLapse, startTime, endTime, currentTime: startTime },
    })),

  // Data texture
  dataTexture: null,
  setDataTexture: (texture) => set({ dataTexture: texture }),

  // Loading
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  // Selection
  selectedEventId: null,
  setSelectedEventId: (selectedEventId) => set({ selectedEventId }),
}));
