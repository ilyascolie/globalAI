import type { CountryInfo } from '../types';

const REST_COUNTRIES_API = 'https://restcountries.com/v3.1';

// Cache for country data
const countryCache = new Map<string, CountryInfo>();
const coordsCache = new Map<string, CountryInfo>();

// Country code to flag emoji mapping
function countryCodeToFlag(code: string): string {
  const codePoints = code
    .toUpperCase()
    .split('')
    .map((char) => 127397 + char.charCodeAt(0));
  return String.fromCodePoint(...codePoints);
}

/**
 * Parse REST Countries API response into our CountryInfo format
 */
function parseCountryData(data: any): CountryInfo {
  const languages = data.languages ? Object.values(data.languages) : [];
  const currencies = data.currencies
    ? Object.values(data.currencies).map((c: any) => `${c.name} (${c.symbol || ''})`)
    : [];

  return {
    name: data.name?.common || '',
    officialName: data.name?.official || '',
    code: data.cca2 || '',
    flag: countryCodeToFlag(data.cca2 || ''),
    capital: data.capital?.[0] || 'N/A',
    population: data.population || 0,
    region: data.region || '',
    subregion: data.subregion || '',
    languages: languages as string[],
    currencies,
    timezones: data.timezones || [],
  };
}

/**
 * Fetch country info by country code (ISO 3166-1 alpha-2)
 */
export async function fetchCountryByCode(code: string): Promise<CountryInfo | null> {
  const cacheKey = code.toUpperCase();

  // Check cache
  if (countryCache.has(cacheKey)) {
    return countryCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `${REST_COUNTRIES_API}/alpha/${code}?fields=name,cca2,capital,population,region,subregion,languages,currencies,timezones`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`REST Countries API error: ${response.status}`);
    }

    const data = await response.json();
    const countryInfo = parseCountryData(data);

    // Cache the result
    countryCache.set(cacheKey, countryInfo);

    return countryInfo;
  } catch (error) {
    console.error('Failed to fetch country by code:', error);
    return null;
  }
}

/**
 * Fetch country info by name
 */
export async function fetchCountryByName(name: string): Promise<CountryInfo | null> {
  const cacheKey = name.toLowerCase();

  // Check cache
  if (countryCache.has(cacheKey)) {
    return countryCache.get(cacheKey)!;
  }

  try {
    const response = await fetch(
      `${REST_COUNTRIES_API}/name/${encodeURIComponent(name)}?fields=name,cca2,capital,population,region,subregion,languages,currencies,timezones`
    );

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      throw new Error(`REST Countries API error: ${response.status}`);
    }

    const data = await response.json();
    // API returns an array, take the first result
    const countryInfo = parseCountryData(Array.isArray(data) ? data[0] : data);

    // Cache the result
    countryCache.set(cacheKey, countryInfo);
    countryCache.set(countryInfo.code.toUpperCase(), countryInfo);

    return countryInfo;
  } catch (error) {
    console.error('Failed to fetch country by name:', error);
    return null;
  }
}

/**
 * Get country from coordinates using reverse geocoding
 */
export async function fetchCountryByCoordinates(
  lat: number,
  lng: number
): Promise<CountryInfo | null> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;

  // Check cache
  if (coordsCache.has(cacheKey)) {
    return coordsCache.get(cacheKey)!;
  }

  try {
    // Use OpenStreetMap Nominatim for reverse geocoding
    const nominatimUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=3&addressdetails=1`;

    const response = await fetch(nominatimUrl, {
      headers: {
        'User-Agent': 'GlobalNewsGlobe/1.0 (contact@example.com)',
      },
    });

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    const countryCode = data.address?.country_code?.toUpperCase();

    if (!countryCode) {
      return null;
    }

    // Fetch full country info using the code
    const countryInfo = await fetchCountryByCode(countryCode);

    if (countryInfo) {
      coordsCache.set(cacheKey, countryInfo);
    }

    return countryInfo;
  } catch (error) {
    console.error('Failed to fetch country by coordinates:', error);
    return null;
  }
}

/**
 * Format population number for display
 */
export function formatPopulation(population: number): string {
  if (population >= 1_000_000_000) {
    return `${(population / 1_000_000_000).toFixed(2)}B`;
  }
  if (population >= 1_000_000) {
    return `${(population / 1_000_000).toFixed(1)}M`;
  }
  if (population >= 1_000) {
    return `${(population / 1_000).toFixed(1)}K`;
  }
  return population.toString();
}
