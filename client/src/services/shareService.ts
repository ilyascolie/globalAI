import type { Event, GeoLocation } from '../types';

/**
 * Generate a shareable URL with event and location information
 */
export function generateShareUrl(event: Event): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    event: event.id,
    lat: event.lat.toFixed(4),
    lng: event.lng.toFixed(4),
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Generate a shareable URL for a location
 */
export function generateLocationShareUrl(location: GeoLocation): string {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const params = new URLSearchParams({
    lat: location.lat.toFixed(4),
    lng: location.lng.toFixed(4),
  });
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Parse event/location information from URL
 */
export function parseShareUrl(url: string): {
  eventId?: string;
  location?: GeoLocation;
} {
  try {
    const urlObj = new URL(url);
    const params = urlObj.searchParams;

    const result: { eventId?: string; location?: GeoLocation } = {};

    const eventId = params.get('event');
    if (eventId) {
      result.eventId = eventId;
    }

    const lat = params.get('lat');
    const lng = params.get('lng');
    if (lat && lng) {
      result.location = {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      };
    }

    return result;
  } catch {
    return {};
  }
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }

    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    const result = document.execCommand('copy');
    document.body.removeChild(textArea);
    return result;
  } catch {
    return false;
  }
}

/**
 * Share using Web Share API if available
 */
export async function shareEvent(event: Event): Promise<boolean> {
  const shareUrl = generateShareUrl(event);

  // Try Web Share API first
  if (navigator.share) {
    try {
      await navigator.share({
        title: event.title,
        text: event.summary,
        url: shareUrl,
      });
      return true;
    } catch (error) {
      // User cancelled or error occurred
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
    }
  }

  // Fall back to clipboard
  return copyToClipboard(shareUrl);
}

/**
 * Open source URL in new tab
 */
export function openSourceUrl(url: string): void {
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(2)}°${latDir}, ${Math.abs(lng).toFixed(2)}°${lngDir}`;
}

/**
 * Encode location in a compact string format
 */
export function encodeLocation(lat: number, lng: number): string {
  // Use a simple base64-like encoding for compact URLs
  const precision = 10000; // 4 decimal places
  const encodedLat = Math.round((lat + 90) * precision);
  const encodedLng = Math.round((lng + 180) * precision);
  return `${encodedLat.toString(36)}.${encodedLng.toString(36)}`;
}

/**
 * Decode location from compact string format
 */
export function decodeLocation(encoded: string): GeoLocation | null {
  try {
    const [latStr, lngStr] = encoded.split('.');
    if (!latStr || !lngStr) return null;

    const precision = 10000;
    const lat = parseInt(latStr, 36) / precision - 90;
    const lng = parseInt(lngStr, 36) / precision - 180;

    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

    return { lat, lng };
  } catch {
    return null;
  }
}
