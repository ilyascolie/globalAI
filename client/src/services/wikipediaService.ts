import type { WikipediaSummary } from '../types';

const WIKIPEDIA_API_BASE = 'https://en.wikipedia.org/api/rest_v1';
const CACHE_DURATION = 1000 * 60 * 30; // 30 minutes

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// Simple in-memory cache
const cache = new Map<string, CacheEntry<WikipediaSummary>>();

/**
 * Clean expired cache entries
 */
function cleanExpiredCache(): void {
  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (now - entry.timestamp > CACHE_DURATION) {
      cache.delete(key);
    }
  }
}

/**
 * Fetch Wikipedia summary for a given title
 */
export async function fetchWikipediaSummary(
  title: string
): Promise<WikipediaSummary | null> {
  const cacheKey = title.toLowerCase();

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }

  try {
    // Normalize title for Wikipedia API
    const normalizedTitle = title.replace(/\s+/g, '_');
    const url = `${WIKIPEDIA_API_BASE}/page/summary/${encodeURIComponent(normalizedTitle)}`;

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Api-User-Agent': 'GlobalNewsGlobe/1.0 (contact@example.com)',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`Wikipedia API error: ${response.status}`);
    }

    const data = await response.json();

    const summary: WikipediaSummary = {
      title: data.title,
      extract: data.extract || '',
      thumbnail: data.thumbnail
        ? {
            source: data.thumbnail.source,
            width: data.thumbnail.width,
            height: data.thumbnail.height,
          }
        : undefined,
      pageUrl: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${normalizedTitle}`,
    };

    // Cache the result
    cache.set(cacheKey, { data: summary, timestamp: Date.now() });
    cleanExpiredCache();

    return summary;
  } catch (error) {
    console.error('Failed to fetch Wikipedia summary:', error);
    return null;
  }
}

/**
 * Fetch Wikipedia summaries for multiple entities
 */
export async function fetchMultipleWikipediaSummaries(
  titles: string[]
): Promise<WikipediaSummary[]> {
  const results = await Promise.allSettled(
    titles.map((title) => fetchWikipediaSummary(title))
  );

  return results
    .filter(
      (result): result is PromiseFulfilledResult<WikipediaSummary> =>
        result.status === 'fulfilled' && result.value !== null
    )
    .map((result) => result.value);
}

/**
 * Search Wikipedia for a query and return the best match summary
 */
export async function searchWikipedia(
  query: string
): Promise<WikipediaSummary | null> {
  try {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
      query
    )}&format=json&origin=*`;

    const response = await fetch(searchUrl);
    if (!response.ok) {
      throw new Error(`Wikipedia search error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.query?.search;

    if (!results || results.length === 0) {
      return null;
    }

    // Get summary for the first result
    return fetchWikipediaSummary(results[0].title);
  } catch (error) {
    console.error('Failed to search Wikipedia:', error);
    return null;
  }
}

/**
 * Fetch Wikipedia summary for a location by coordinates
 */
export async function fetchLocationWikipediaSummary(
  lat: number,
  lng: number
): Promise<WikipediaSummary | null> {
  try {
    const geoSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=10000&gslimit=1&format=json&origin=*`;

    const response = await fetch(geoSearchUrl);
    if (!response.ok) {
      throw new Error(`Wikipedia geosearch error: ${response.status}`);
    }

    const data = await response.json();
    const results = data.query?.geosearch;

    if (!results || results.length === 0) {
      return null;
    }

    return fetchWikipediaSummary(results[0].title);
  } catch (error) {
    console.error('Failed to fetch location Wikipedia summary:', error);
    return null;
  }
}
