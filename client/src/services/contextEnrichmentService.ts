import type { Event, EventContext } from '../types';
import {
  fetchWikipediaSummary,
  fetchMultipleWikipediaSummaries,
  fetchLocationWikipediaSummary,
} from './wikipediaService';
import { fetchCountryByCoordinates } from './countryService';
import { fetchHistoricalContext } from './historicalContextService';

/**
 * Fetch all context enrichment data for an event
 */
export async function fetchEventContext(
  event: Event
): Promise<EventContext> {
  const context: EventContext = {
    entitySummaries: [],
    loading: true,
  };

  try {
    // Run all fetches in parallel for better performance
    const [locationSummary, countryInfo, historicalContext, entitySummaries] =
      await Promise.allSettled([
        // Location summary from coordinates
        fetchLocationWikipediaSummary(event.lat, event.lng),
        // Country info
        fetchCountryByCoordinates(event.lat, event.lng),
        // Historical context
        fetchHistoricalContext(event.lat, event.lng),
        // Entity summaries (limit to first 3 entities to avoid too many requests)
        fetchMultipleWikipediaSummaries(event.entities.slice(0, 3)),
      ]);

    // Process results
    if (locationSummary.status === 'fulfilled' && locationSummary.value) {
      context.locationSummary = locationSummary.value;
    }

    if (countryInfo.status === 'fulfilled' && countryInfo.value) {
      context.countryInfo = countryInfo.value;
    }

    if (historicalContext.status === 'fulfilled' && historicalContext.value) {
      context.historicalContext = historicalContext.value;
    }

    if (entitySummaries.status === 'fulfilled') {
      context.entitySummaries = entitySummaries.value;
    }

    context.loading = false;
    return context;
  } catch (error) {
    console.error('Failed to fetch event context:', error);
    return {
      ...context,
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to fetch context',
    };
  }
}

/**
 * Fetch context for a location (without specific event)
 */
export async function fetchLocationContext(
  lat: number,
  lng: number
): Promise<EventContext> {
  const context: EventContext = {
    entitySummaries: [],
    loading: true,
  };

  try {
    const [locationSummary, countryInfo, historicalContext] =
      await Promise.allSettled([
        fetchLocationWikipediaSummary(lat, lng),
        fetchCountryByCoordinates(lat, lng),
        fetchHistoricalContext(lat, lng),
      ]);

    if (locationSummary.status === 'fulfilled' && locationSummary.value) {
      context.locationSummary = locationSummary.value;
    }

    if (countryInfo.status === 'fulfilled' && countryInfo.value) {
      context.countryInfo = countryInfo.value;
    }

    if (historicalContext.status === 'fulfilled' && historicalContext.value) {
      context.historicalContext = historicalContext.value;
    }

    context.loading = false;
    return context;
  } catch (error) {
    console.error('Failed to fetch location context:', error);
    return {
      ...context,
      loading: false,
      error: error instanceof Error ? error.message : 'Failed to fetch context',
    };
  }
}

/**
 * Hook-friendly wrapper for fetching event context
 */
export function useEventContext(event: Event | null) {
  // This will be implemented as a custom hook that uses React Query or similar
  // For now, we export the raw function
}
