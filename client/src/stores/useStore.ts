import { create } from 'zustand';
import type { Event, Prediction, ViewMode, FilterState, HeatmapPoint } from '../types';

interface AppState {
  // View mode
  mode: ViewMode;
  setMode: (mode: ViewMode) => void;

  // Events (news)
  events: Event[];
  setEvents: (events: Event[]) => void;
  selectedEvent: Event | null;
  setSelectedEvent: (event: Event | null) => void;

  // Predictions
  predictions: Prediction[];
  setPredictions: (predictions: Prediction[]) => void;
  selectedPrediction: Prediction | null;
  setSelectedPrediction: (prediction: Prediction | null) => void;

  // Heatmap data
  heatmapPoints: HeatmapPoint[];
  setHeatmapPoints: (points: HeatmapPoint[]) => void;

  // Filters
  filters: FilterState;
  setFilters: (filters: Partial<FilterState>) => void;

  // UI state
  isPanelOpen: boolean;
  setIsPanelOpen: (isOpen: boolean) => void;
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;

  // Globe camera
  cameraPosition: { lat: number; lng: number; altitude: number };
  setCameraPosition: (pos: { lat: number; lng: number; altitude: number }) => void;
}

export const useStore = create<AppState>((set) => ({
  // View mode
  mode: 'predictions',
  setMode: (mode) => set({ mode, selectedEvent: null, selectedPrediction: null }),

  // Events
  events: [],
  setEvents: (events) => set({ events }),
  selectedEvent: null,
  setSelectedEvent: (selectedEvent) => set({ selectedEvent, isPanelOpen: !!selectedEvent }),

  // Predictions
  predictions: [],
  setPredictions: (predictions) => set({ predictions }),
  selectedPrediction: null,
  setSelectedPrediction: (selectedPrediction) => set({ selectedPrediction, isPanelOpen: !!selectedPrediction }),

  // Heatmap
  heatmapPoints: [],
  setHeatmapPoints: (heatmapPoints) => set({ heatmapPoints }),

  // Filters
  filters: {
    mode: 'predictions',
    timeRange: '24h',
    categories: [],
    minProbability: 0,
    maxProbability: 1,
    minVolume: 0,
    closingSoon: false,
  },
  setFilters: (newFilters) =>
    set((state) => ({ filters: { ...state.filters, ...newFilters } })),

  // UI state
  isPanelOpen: false,
  setIsPanelOpen: (isPanelOpen) => set({ isPanelOpen }),
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),

  // Camera
  cameraPosition: { lat: 20, lng: 0, altitude: 2.5 },
  setCameraPosition: (cameraPosition) => set({ cameraPosition }),
}));
