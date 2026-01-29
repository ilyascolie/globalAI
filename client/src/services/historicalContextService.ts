import type { Event, HistoricalContext, EventCategory } from '../types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Calculate date ranges for historical context
 */
function getDateRanges(): {
  pastWeek: Date;
  pastMonth: Date;
} {
  const now = new Date();
  const pastWeek = new Date(now);
  pastWeek.setDate(pastWeek.getDate() - 7);

  const pastMonth = new Date(now);
  pastMonth.setMonth(pastMonth.getMonth() - 1);

  return { pastWeek, pastMonth };
}

/**
 * Count events by category
 */
function countByCategory(
  events: Event[]
): Array<{ category: string; count: number }> {
  const counts = new Map<string, number>();

  for (const event of events) {
    const current = counts.get(event.category) || 0;
    counts.set(event.category, current + 1);
  }

  return Array.from(counts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get the most significant events from a list
 */
function getMostSignificant(events: Event[], limit: number = 5): Event[] {
  return [...events]
    .sort((a, b) => b.intensity - a.intensity)
    .slice(0, limit);
}

/**
 * Fetch historical context for a region from the API
 */
export async function fetchHistoricalContext(
  lat: number,
  lng: number,
  radiusKm: number = 100
): Promise<HistoricalContext | null> {
  const { pastWeek, pastMonth } = getDateRanges();

  try {
    // Fetch events from the past month in this region
    const response = await fetch(
      `${API_BASE}/api/events?` +
        new URLSearchParams({
          lat: lat.toString(),
          lng: lng.toString(),
          radius: radiusKm.toString(),
          since: pastMonth.toISOString(),
          limit: '100',
        })
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const events: Event[] = data.events || [];

    if (events.length === 0) {
      return null;
    }

    // Count events in past week
    const pastWeekEvents = events.filter(
      (e) => new Date(e.timestamp) >= pastWeek
    );

    // Get location name from the first event or use coordinates
    const regionName = getRegionName(events, lat, lng);

    const context: HistoricalContext = {
      regionName,
      eventCountPastMonth: events.length,
      eventCountPastWeek: pastWeekEvents.length,
      dominantCategories: countByCategory(events),
      significantEvents: getMostSignificant(events).map((e) => ({
        id: e.id,
        title: e.title,
        timestamp: e.timestamp,
      })),
    };

    return context;
  } catch (error) {
    console.error('Failed to fetch historical context:', error);
    return null;
  }
}

/**
 * Extract region name from events or create a generic one
 */
function getRegionName(events: Event[], lat: number, lng: number): string {
  // Try to find a common location entity in the events
  const locationCounts = new Map<string, number>();

  for (const event of events) {
    for (const entity of event.entities) {
      // Simple heuristic: assume capitalized multi-word strings are locations
      if (
        entity.includes(' ') &&
        entity[0] === entity[0].toUpperCase()
      ) {
        const count = locationCounts.get(entity) || 0;
        locationCounts.set(entity, count + 1);
      }
    }
  }

  // Find most common location
  let maxCount = 0;
  let regionName = `Region (${lat.toFixed(1)}°, ${lng.toFixed(1)}°)`;

  for (const [location, count] of locationCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      regionName = location;
    }
  }

  return regionName;
}

/**
 * Build historical context from local event data (when API is unavailable)
 */
export function buildHistoricalContextFromEvents(
  events: Event[],
  lat: number,
  lng: number,
  radiusKm: number = 100
): HistoricalContext {
  const { pastWeek, pastMonth } = getDateRanges();

  // Filter events by distance (simplified calculation)
  const nearbyEvents = events.filter((e) => {
    const distance = haversineDistance(lat, lng, e.lat, e.lng);
    return distance <= radiusKm;
  });

  // Filter by time
  const pastMonthEvents = nearbyEvents.filter(
    (e) => new Date(e.timestamp) >= pastMonth
  );
  const pastWeekEvents = nearbyEvents.filter(
    (e) => new Date(e.timestamp) >= pastWeek
  );

  const regionName = getRegionName(pastMonthEvents, lat, lng);

  return {
    regionName,
    eventCountPastMonth: pastMonthEvents.length,
    eventCountPastWeek: pastWeekEvents.length,
    dominantCategories: countByCategory(pastMonthEvents),
    significantEvents: getMostSignificant(pastMonthEvents).map((e) => ({
      id: e.id,
      title: e.title,
      timestamp: e.timestamp,
    })),
  };
}

/**
 * Haversine formula for distance between two points
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format the historical context as a human-readable string
 */
export function formatHistoricalSummary(context: HistoricalContext): string {
  const { regionName, eventCountPastMonth, eventCountPastWeek, dominantCategories } = context;

  let summary = `${regionName} has had ${eventCountPastMonth} event${
    eventCountPastMonth !== 1 ? 's' : ''
  } in the past month`;

  if (eventCountPastWeek > 0) {
    summary += ` (${eventCountPastWeek} in the past week)`;
  }

  if (dominantCategories.length > 0) {
    const topCategory = dominantCategories[0].category;
    summary += `. Most common: ${topCategory}`;
  }

  return summary;
}
