import * as THREE from 'three';

export interface LatLong {
  lat: number;
  lng: number;
}

export interface GlobePosition {
  x: number;
  y: number;
  z: number;
}

/**
 * Convert latitude/longitude to 3D position on a sphere
 */
export function latLongToVector3(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

/**
 * Convert 3D position on sphere surface to latitude/longitude
 */
export function vector3ToLatLong(position: THREE.Vector3): LatLong {
  const normalizedPosition = position.clone().normalize();

  const lat = 90 - Math.acos(normalizedPosition.y) * (180 / Math.PI);
  const lng =
    ((270 + Math.atan2(normalizedPosition.x, normalizedPosition.z) * (180 / Math.PI)) % 360) - 180;

  return { lat, lng };
}

/**
 * Calculate sun direction based on current time (UTC)
 * Returns a normalized vector pointing towards the sun
 */
export function getSunDirection(date: Date = new Date()): THREE.Vector3 {
  // Get hours as decimal (0-24)
  const hours = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600;

  // Day of year (for seasonal variation)
  const start = new Date(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Calculate sun declination (seasonal tilt)
  // Maximum declination is ~23.44 degrees at summer/winter solstice
  const declination = 23.44 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365);

  // Calculate sun's position
  // The sun completes one full rotation (360 degrees) in 24 hours
  const sunLongitude = -((hours / 24) * 360 - 180);
  const sunLatitude = declination;

  return latLongToVector3(sunLatitude, sunLongitude, 1).normalize();
}

/**
 * Interpolate between two positions for smooth camera animation
 */
export function lerpVector3(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number
): THREE.Vector3 {
  return new THREE.Vector3().lerpVectors(start, end, t);
}

/**
 * Spherical linear interpolation for smooth rotation around the globe
 */
export function slerpPositions(
  start: THREE.Vector3,
  end: THREE.Vector3,
  t: number,
  radius: number
): THREE.Vector3 {
  const startSpherical = new THREE.Spherical().setFromVector3(start);
  const endSpherical = new THREE.Spherical().setFromVector3(end);

  const phi = startSpherical.phi + (endSpherical.phi - startSpherical.phi) * t;
  const theta = startSpherical.theta + (endSpherical.theta - startSpherical.theta) * t;

  return new THREE.Vector3().setFromSpherical(
    new THREE.Spherical(radius, phi, theta)
  );
}

/**
 * Format coordinates for display
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? 'N' : 'S';
  const lngDir = lng >= 0 ? 'E' : 'W';

  return `${Math.abs(lat).toFixed(2)}° ${latDir}, ${Math.abs(lng).toFixed(2)}° ${lngDir}`;
}

/**
 * Calculate distance between two points on the globe (in km)
 * Using the Haversine formula
 */
export function calculateDistance(
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
