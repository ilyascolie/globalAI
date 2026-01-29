import { useCallback, useRef } from 'react';
import * as THREE from 'three';
import type { ClickPosition, Event, EventCluster, EventSelection, GeoLocation } from '../types';

interface GlobeClickConfig {
  globeRadius?: number;
  clusterRadius?: number; // km - radius to consider events as clustered
}

interface UseGlobeClickOptions {
  events: Event[];
  clusters: EventCluster[];
  onEventSelect?: (selection: EventSelection) => void;
  config?: GlobeClickConfig;
}

interface UseGlobeClickReturn {
  handleGlobeClick: (lat: number, lng: number) => void;
  screenToGeo: (
    screenX: number,
    screenY: number,
    camera: THREE.Camera,
    globeMesh: THREE.Mesh
  ) => GeoLocation | null;
  findNearbyEvents: (lat: number, lng: number, radiusKm?: number) => Event[];
  findNearestCluster: (lat: number, lng: number) => EventCluster | null;
}

const DEFAULT_CONFIG: GlobeClickConfig = {
  globeRadius: 100,
  clusterRadius: 50, // 50km default cluster radius
};

// Haversine formula for distance between two lat/lng points
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

// Convert lat/lng to 3D cartesian coordinates
function geoToCartesian(
  lat: number,
  lng: number,
  radius: number
): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;

  const x = -(radius * Math.sin(phi) * Math.cos(theta));
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

// Convert 3D cartesian coordinates to lat/lng
function cartesianToGeo(point: THREE.Vector3): GeoLocation {
  const radius = point.length();
  const lat = 90 - (Math.acos(point.y / radius) * 180) / Math.PI;
  const lng = ((Math.atan2(point.z, -point.x) * 180) / Math.PI) - 180;

  return {
    lat,
    lng: lng < -180 ? lng + 360 : lng > 180 ? lng - 360 : lng,
  };
}

/**
 * Hook for handling globe click interactions and finding events at click locations
 */
export function useGlobeClick(options: UseGlobeClickOptions): UseGlobeClickReturn {
  const { events, clusters, onEventSelect, config = DEFAULT_CONFIG } = options;
  const mergedConfig = { ...DEFAULT_CONFIG, ...config };

  const raycasterRef = useRef(new THREE.Raycaster());

  /**
   * Convert screen coordinates to geographic coordinates using raycasting
   */
  const screenToGeo = useCallback(
    (
      screenX: number,
      screenY: number,
      camera: THREE.Camera,
      globeMesh: THREE.Mesh
    ): GeoLocation | null => {
      // Normalize screen coordinates to [-1, 1] range
      const canvas = document.querySelector('canvas');
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      const x = ((screenX - rect.left) / rect.width) * 2 - 1;
      const y = -((screenY - rect.top) / rect.height) * 2 + 1;

      // Set up raycaster
      raycasterRef.current.setFromCamera(new THREE.Vector2(x, y), camera);

      // Find intersection with globe
      const intersects = raycasterRef.current.intersectObject(globeMesh, true);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        return cartesianToGeo(point);
      }

      return null;
    },
    []
  );

  /**
   * Find all events within a radius of a geographic point
   */
  const findNearbyEvents = useCallback(
    (lat: number, lng: number, radiusKm: number = mergedConfig.clusterRadius!): Event[] => {
      return events.filter((event) => {
        const distance = haversineDistance(lat, lng, event.lat, event.lng);
        return distance <= radiusKm;
      });
    },
    [events, mergedConfig.clusterRadius]
  );

  /**
   * Find the nearest cluster to a geographic point
   */
  const findNearestCluster = useCallback(
    (lat: number, lng: number): EventCluster | null => {
      if (clusters.length === 0) return null;

      let nearestCluster: EventCluster | null = null;
      let minDistance = Infinity;

      for (const cluster of clusters) {
        const distance = haversineDistance(lat, lng, cluster.centerLat, cluster.centerLng);
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = cluster;
        }
      }

      // Only return if within reasonable distance (e.g., 100km)
      return minDistance <= 100 ? nearestCluster : null;
    },
    [clusters]
  );

  /**
   * Handle a click on the globe at specific coordinates
   */
  const handleGlobeClick = useCallback(
    (lat: number, lng: number) => {
      // First, check if there's a cluster at this location
      const nearestCluster = findNearestCluster(lat, lng);

      // Find individual events near the click
      const nearbyEvents = findNearbyEvents(lat, lng, 25); // 25km for individual event selection

      if (nearbyEvents.length === 0 && !nearestCluster) {
        // No events at this location
        return;
      }

      let selection: EventSelection;

      if (nearbyEvents.length === 1) {
        // Single event - show event detail
        selection = {
          type: 'single',
          event: nearbyEvents[0],
          position: { lat, lng },
        };
      } else if (nearbyEvents.length > 1 || nearestCluster) {
        // Multiple events - show cluster view
        const cluster = nearestCluster || {
          id: `temp-cluster-${lat}-${lng}`,
          h3Index: '',
          centerLat: lat,
          centerLng: lng,
          events: nearbyEvents,
          totalIntensity: nearbyEvents.reduce((sum, e) => sum + e.intensity, 0),
          dominantCategory: nearbyEvents[0]?.category || 'politics',
          eventCount: nearbyEvents.length,
        };

        selection = {
          type: 'cluster',
          cluster,
          position: { lat, lng },
        };
      } else {
        return;
      }

      if (onEventSelect) {
        onEventSelect(selection);
      }
    },
    [findNearbyEvents, findNearestCluster, onEventSelect]
  );

  return {
    handleGlobeClick,
    screenToGeo,
    findNearbyEvents,
    findNearestCluster,
  };
}

export { haversineDistance, geoToCartesian, cartesianToGeo };
