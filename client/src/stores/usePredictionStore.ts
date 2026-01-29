import { create } from 'zustand';
import type { Prediction, PredictionCategory } from '../types';

export interface PredictionFilters {
  minProbability: number;
  maxProbability: number;
  minVolume: number;
  categories: PredictionCategory[];
  closingSoon: boolean;
}

interface PredictionState {
  predictions: Prediction[];
  selectedPrediction: Prediction | null;
  isLoading: boolean;
  filters: PredictionFilters;

  setPredictions: (predictions: Prediction[]) => void;
  setSelectedPrediction: (prediction: Prediction | null) => void;
  setIsLoading: (loading: boolean) => void;
  setFilters: (filters: Partial<PredictionFilters>) => void;
  toggleCategory: (category: PredictionCategory) => void;
}

export const usePredictionStore = create<PredictionState>((set) => ({
  predictions: [],
  selectedPrediction: null,
  isLoading: false,
  filters: {
    minProbability: 0,
    maxProbability: 1,
    minVolume: 0,
    categories: [],
    closingSoon: false,
  },

  setPredictions: (predictions) => set({ predictions }),

  setSelectedPrediction: (selectedPrediction) => set({ selectedPrediction }),

  setIsLoading: (isLoading) => set({ isLoading }),

  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    })),

  toggleCategory: (category) =>
    set((state) => {
      const categories = state.filters.categories.includes(category)
        ? state.filters.categories.filter((c) => c !== category)
        : [...state.filters.categories, category];
      return { filters: { ...state.filters, categories } };
    }),
}));
