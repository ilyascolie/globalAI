import * as h3 from 'h3-js';
import type { Event, HeatmapPoint, HotSpot, EventCategory, TimeRange } from '../types';

// H3 resolution for different zoom levels
const H3_RESOLUTION_GLOBAL = 3; // ~100km hexagons
const H3_RESOLUTION_REGIONAL = 4; // ~30km hexagons
const H3_RESOLUTION_LOCAL = 5; // ~10km hexagons

// Time range to milliseconds
const TIME_RANGE_MS: Record<TimeRange, number> = {
  '1h': 60 * 60 * 1000,
  '6h': 6 * 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

// Category weights for intensity calculation
const CATEGORY_WEIGHTS: Record<EventCategory, number> = {
  conflict: 1.5,
  disaster: 1.4,
  politics: 1.2,
  economics: 1.0,
  health: 1.1,
  technology: 0.8,
  environment: 0.9,
};

/**
 * Calculate temporal decay factor based on event age
 * Recent events weighted higher than older ones
 */
export function calculateTemporalDecay(
  eventTimestamp: Date,
  referenceTime: Date,
  timeRange: TimeRange
): number {
  const ageMs = referenceTime.getTime() - eventTimestamp.getTime();
  const rangeMs = TIME_RANGE_MS[timeRange];

  // Events outside the time range get 0 weight
  if (ageMs > rangeMs || ageMs < 0) return 0;

  // Exponential decay: e^(-k * t)
  // Half-life at 1/4 of the time range
  const halfLife = rangeMs / 4;
  const decay = Math.exp((-Math.LN2 * ageMs) / halfLife);

  return decay;
}

/**
 * Aggregate events into H3 hexagonal bins
 */
export function aggregateEventsToH3(
  events: Event[],
  timeRange: TimeRange,
  categories: Set<EventCategory>,
  resolution: number = H3_RESOLUTION_GLOBAL
): HeatmapPoint[] {
  const now = new Date();
  const bins = new Map<string, {
    events: Event[];
    totalIntensity: number;
    decayedIntensity: number;
    categoryCount: Map<EventCategory, number>;
  }>();

  // Filter and bin events
  for (const event of events) {
    // Skip if category filtered out
    if (!categories.has(event.category)) continue;

    // Calculate temporal decay
    const decay = calculateTemporalDecay(event.timestamp, now, timeRange);
    if (decay === 0) continue;

    // Get H3 index for this location
    const h3Index = h3.latLngToCell(event.lat, event.lng, resolution);

    // Get or create bin
    let bin = bins.get(h3Index);
    if (!bin) {
      bin = {
        events: [],
        totalIntensity: 0,
        decayedIntensity: 0,
        categoryCount: new Map(),
      };
      bins.set(h3Index, bin);
    }

    // Add event to bin
    bin.events.push(event);

    // Calculate weighted intensity
    const categoryWeight = CATEGORY_WEIGHTS[event.category];
    const weightedIntensity = event.intensity * categoryWeight;

    bin.totalIntensity += weightedIntensity;
    bin.decayedIntensity += weightedIntensity * decay;

    // Track category counts
    const catCount = bin.categoryCount.get(event.category) || 0;
    bin.categoryCount.set(event.category, catCount + 1);
  }

  // Convert bins to HeatmapPoints
  const points: HeatmapPoint[] = [];

  for (const [h3Index, bin] of bins) {
    // Get hex center coordinates
    const [lat, lng] = h3.cellToLatLng(h3Index);

    // Find dominant category
    let dominantCategory: EventCategory = 'politics';
    let maxCount = 0;
    for (const [category, count] of bin.categoryCount) {
      if (count > maxCount) {
        maxCount = count;
        dominantCategory = category;
      }
    }

    points.push({
      lat,
      lng,
      intensity: bin.totalIntensity,
      decayedIntensity: bin.decayedIntensity,
      eventCount: bin.events.length,
      dominantCategory,
      h3Index,
      events: bin.events,
    });
  }

  return points;
}

/**
 * Normalize intensities to prevent one huge story from washing out everything
 * Uses logarithmic scaling with percentile-based normalization
 */
export function normalizeIntensities(points: HeatmapPoint[]): HeatmapPoint[] {
  if (points.length === 0) return points;

  // Get all intensities
  const intensities = points.map((p) => p.decayedIntensity);

  // Calculate percentiles for robust normalization
  const sorted = [...intensities].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 1;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 1;

  // Use log scaling to compress the range
  // Normalize so p95 maps to ~0.9 and median maps to ~0.4
  return points.map((point) => {
    // Log transform to handle wide dynamic range
    const logIntensity = Math.log1p(point.decayedIntensity);
    const logP50 = Math.log1p(p50);
    const logP95 = Math.log1p(p95);

    // Linear interpolation in log space
    let normalized: number;
    if (logIntensity <= logP50) {
      // Lower half: map 0-p50 to 0-0.4
      normalized = (logIntensity / logP50) * 0.4;
    } else {
      // Upper half: map p50-p95 to 0.4-0.9, cap at 1.0
      const ratio = (logIntensity - logP50) / (logP95 - logP50);
      normalized = 0.4 + ratio * 0.5;
    }

    // Clamp to 0-1 range
    normalized = Math.max(0, Math.min(1, normalized));

    return {
      ...point,
      intensity: normalized * 100, // Store as 0-100
      decayedIntensity: normalized,
    };
  });
}

/**
 * Generate top 5 hot spots (most active regions)
 */
export function generateHotSpots(
  points: HeatmapPoint[],
  count: number = 5
): HotSpot[] {
  // Sort by decayed intensity (already normalized)
  const sorted = [...points].sort(
    (a, b) => b.decayedIntensity - a.decayedIntensity
  );

  // Take top N
  return sorted.slice(0, count).map((point) => ({
    name: getRegionName(point.lat, point.lng),
    lat: point.lat,
    lng: point.lng,
    totalIntensity: point.decayedIntensity * 100,
    eventCount: point.eventCount,
    dominantCategory: point.dominantCategory,
    h3Index: point.h3Index,
  }));
}

/**
 * Get a human-readable region name for coordinates
 * In production, this would use reverse geocoding
 */
function getRegionName(lat: number, lng: number): string {
  // Simplified region detection based on lat/lng quadrants
  // In production, use reverse geocoding API

  let region = '';

  // Latitude-based
  if (lat > 60) region = 'Northern ';
  else if (lat > 30) region = 'North ';
  else if (lat > -30) region = 'Central ';
  else if (lat > -60) region = 'South ';
  else region = 'Southern ';

  // Longitude-based continents (simplified)
  if (lng > -30 && lng < 60) {
    if (lat > 35) region += 'Europe';
    else if (lat > -35) region += 'Africa';
    else region += 'Atlantic';
  } else if (lng >= 60 && lng < 150) {
    if (lat > 0) region += 'Asia';
    else region += 'Oceania';
  } else if (lng >= -170 && lng < -30) {
    if (lat > 15) region += 'America';
    else if (lat > -15) region += 'America';
    else region += 'America';
  } else {
    region += 'Pacific';
  }

  return region;
}

/**
 * Create data texture from heatmap points
 * Returns a 360x180 Float32Array (1 degree resolution)
 */
export function createDataTexture(
  points: HeatmapPoint[],
  radius: number = 1.5,
  falloff: number = 2.0
): Float32Array {
  const width = 360;
  const height = 180;
  const data = new Float32Array(width * height);

  // For each point, splat intensity to nearby pixels
  for (const point of points) {
    const intensity = point.decayedIntensity;
    if (intensity <= 0) continue;

    // Convert lat/lng to texture coordinates
    const centerX = Math.floor((point.lng + 180) % 360);
    const centerY = Math.floor(point.lat + 90);

    // Radius in pixels (degrees)
    const radiusPx = Math.ceil(radius * 2);

    // Splat intensity with falloff
    for (let dy = -radiusPx; dy <= radiusPx; dy++) {
      for (let dx = -radiusPx; dx <= radiusPx; dx++) {
        const x = (centerX + dx + width) % width;
        const y = Math.max(0, Math.min(height - 1, centerY + dy));

        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > radiusPx) continue;

        // Falloff based on distance
        const falloffFactor = Math.pow(1 - dist / radiusPx, falloff);
        const contribution = intensity * falloffFactor;

        const index = y * width + x;
        data[index] = Math.min(1, data[index] + contribution);
      }
    }
  }

  return data;
}

/**
 * Get appropriate H3 resolution based on camera altitude
 */
export function getH3Resolution(altitude: number): number {
  if (altitude > 3) return H3_RESOLUTION_GLOBAL;
  if (altitude > 1.5) return H3_RESOLUTION_REGIONAL;
  return H3_RESOLUTION_LOCAL;
}

/**
 * Process events through the full pipeline
 */
export function processEvents(
  events: Event[],
  timeRange: TimeRange,
  categories: Set<EventCategory>,
  radius: number,
  falloff: number
): {
  points: HeatmapPoint[];
  hotSpots: HotSpot[];
  dataTexture: Float32Array;
} {
  // Aggregate into H3 bins
  const rawPoints = aggregateEventsToH3(events, timeRange, categories);

  // Normalize intensities
  const points = normalizeIntensities(rawPoints);

  // Generate hot spots
  const hotSpots = generateHotSpots(points);

  // Create data texture for shader
  const dataTexture = createDataTexture(points, radius, falloff);

  return { points, hotSpots, dataTexture };
}
