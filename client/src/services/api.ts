import axios from 'axios';
import type { Event, Prediction, HeatmapPoint } from '../types';

const API_BASE = '/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
});

// Events API
export interface EventsResponse {
  events: Event[];
  total: number;
  hasMore: boolean;
}

export async function fetchEvents(params?: {
  categories?: string[];
  since?: Date;
  bounds?: string;
  limit?: number;
}): Promise<EventsResponse> {
  const response = await api.get<EventsResponse>('/events', {
    params: {
      categories: params?.categories?.join(','),
      since: params?.since?.toISOString(),
      bounds: params?.bounds,
      limit: params?.limit,
    },
  });
  return response.data;
}

export async function fetchEvent(id: string): Promise<Event> {
  const response = await api.get<Event>(`/events/${id}`);
  return response.data;
}

// Heatmap API
export interface HeatmapResponse {
  points: HeatmapPoint[];
  maxIntensity: number;
  timeRange: string;
}

export async function fetchHeatmap(params?: {
  resolution?: 'low' | 'medium' | 'high';
  timeRange?: string;
}): Promise<HeatmapResponse> {
  const response = await api.get<HeatmapResponse>('/heatmap', { params });
  return response.data;
}

// Predictions API
export interface PredictionsResponse {
  predictions: Prediction[];
  total: number;
  lastUpdated: Date;
}

export async function fetchPredictions(params?: {
  minProbability?: number;
  maxProbability?: number;
  minVolume?: number;
  categories?: string[];
  closingSoon?: boolean;
}): Promise<PredictionsResponse> {
  const response = await api.get<PredictionsResponse>('/predictions', {
    params: {
      ...params,
      categories: params?.categories?.join(','),
    },
  });
  return {
    ...response.data,
    lastUpdated: new Date(response.data.lastUpdated),
  };
}

export async function fetchPrediction(marketId: string): Promise<Prediction> {
  const response = await api.get<Prediction>(`/predictions/${marketId}`);
  return response.data;
}

export async function refreshPredictions(): Promise<void> {
  await api.post('/predictions/refresh');
}
