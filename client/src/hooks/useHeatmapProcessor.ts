import { useEffect, useCallback, useRef } from 'react';
import { useHeatmapStore } from '../stores/useHeatmapStore';
import { processEvents } from '../utils/h3Binning';

/**
 * Hook that processes events and updates the heatmap data
 * Handles filtering, H3 binning, temporal decay, and data texture generation
 */
export function useHeatmapProcessor() {
  const {
    events,
    filters,
    config,
    setHeatmapPoints,
    setHotSpots,
    setDataTexture,
    timeLapse,
    setTimeLapseTime,
  } = useHeatmapStore();

  const timeLapseIntervalRef = useRef<number | null>(null);

  // Process events when filters, config, or events change
  const processData = useCallback(() => {
    if (events.length === 0) return;

    const { points, hotSpots, dataTexture } = processEvents(
      events,
      filters.timeRange,
      filters.categories,
      config.radius,
      config.intensityFalloff
    );

    setHeatmapPoints(points);
    setHotSpots(hotSpots);
    setDataTexture(dataTexture);
  }, [
    events,
    filters.timeRange,
    filters.categories,
    config.radius,
    config.intensityFalloff,
    setHeatmapPoints,
    setHotSpots,
    setDataTexture,
  ]);

  // Debounced processing to prevent excessive updates
  useEffect(() => {
    const timeoutId = setTimeout(processData, 100);
    return () => clearTimeout(timeoutId);
  }, [processData]);

  // Time-lapse mode animation
  useEffect(() => {
    if (timeLapse.isPlaying) {
      timeLapseIntervalRef.current = window.setInterval(() => {
        const { currentTime, endTime, speed, startTime } = timeLapse;
        const newTime = new Date(
          currentTime.getTime() + speed * 60 * 1000 // Advance by speed minutes
        );

        if (newTime >= endTime) {
          // Loop back to start
          setTimeLapseTime(startTime);
        } else {
          setTimeLapseTime(newTime);
        }
      }, 100); // Update every 100ms
    }

    return () => {
      if (timeLapseIntervalRef.current) {
        clearInterval(timeLapseIntervalRef.current);
      }
    };
  }, [timeLapse.isPlaying, timeLapse.speed, setTimeLapseTime, timeLapse]);

  return { processData };
}

/**
 * Hook to generate sample event data for demonstration
 */
export function useSampleData() {
  const { setEvents, addPulseEvent, setIsLoading } = useHeatmapStore();

  const generateSampleEvents = useCallback(() => {
    setIsLoading(true);

    // Sample locations with realistic event distributions
    const locations = [
      // High activity regions
      { lat: 38.9, lng: -77.0, region: 'Washington DC', weight: 5 },
      { lat: 51.5, lng: -0.1, region: 'London', weight: 4 },
      { lat: 48.9, lng: 2.3, region: 'Paris', weight: 3 },
      { lat: 35.7, lng: 139.7, region: 'Tokyo', weight: 3 },
      { lat: 31.2, lng: 121.5, region: 'Shanghai', weight: 4 },
      { lat: 55.8, lng: 37.6, region: 'Moscow', weight: 4 },
      { lat: 28.6, lng: 77.2, region: 'New Delhi', weight: 3 },
      { lat: -23.5, lng: -46.6, region: 'Sao Paulo', weight: 2 },
      { lat: 40.7, lng: -74.0, region: 'New York', weight: 4 },
      { lat: 34.0, lng: -118.2, region: 'Los Angeles', weight: 2 },

      // Conflict zones
      { lat: 50.4, lng: 30.5, region: 'Kyiv', weight: 6 },
      { lat: 31.8, lng: 35.2, region: 'Jerusalem', weight: 5 },
      { lat: 33.9, lng: 35.5, region: 'Beirut', weight: 4 },
      { lat: 15.4, lng: 44.2, region: 'Sanaa', weight: 3 },

      // Other notable cities
      { lat: 52.5, lng: 13.4, region: 'Berlin', weight: 2 },
      { lat: 41.9, lng: 12.5, region: 'Rome', weight: 2 },
      { lat: 59.3, lng: 18.1, region: 'Stockholm', weight: 1 },
      { lat: -33.9, lng: 18.4, region: 'Cape Town', weight: 2 },
      { lat: 1.3, lng: 103.8, region: 'Singapore', weight: 2 },
      { lat: 22.3, lng: 114.2, region: 'Hong Kong', weight: 3 },
      { lat: 37.6, lng: 127.0, region: 'Seoul', weight: 2 },
      { lat: -34.6, lng: -58.4, region: 'Buenos Aires', weight: 1 },
      { lat: 19.4, lng: -99.1, region: 'Mexico City', weight: 2 },
      { lat: 6.5, lng: 3.4, region: 'Lagos', weight: 2 },
      { lat: 30.0, lng: 31.2, region: 'Cairo', weight: 3 },
    ];

    const categories: Array<
      | 'conflict'
      | 'politics'
      | 'disaster'
      | 'economics'
      | 'health'
      | 'technology'
      | 'environment'
    > = [
      'conflict',
      'politics',
      'disaster',
      'economics',
      'health',
      'technology',
      'environment',
    ];

    const events = [];
    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    // Generate events for each location
    for (const loc of locations) {
      const numEvents = Math.floor(loc.weight * (3 + Math.random() * 5));

      for (let i = 0; i < numEvents; i++) {
        // Add some randomness to position (within ~50km)
        const lat = loc.lat + (Math.random() - 0.5) * 0.5;
        const lng = loc.lng + (Math.random() - 0.5) * 0.5;

        // Random timestamp within last 7 days, weighted towards recent
        const recencyBias = Math.pow(Math.random(), 0.5); // More recent events
        const timestamp = new Date(
          sevenDaysAgo + recencyBias * (now - sevenDaysAgo)
        );

        // Category based on region and randomness
        let category = categories[Math.floor(Math.random() * categories.length)];
        if (
          loc.region === 'Kyiv' ||
          loc.region === 'Jerusalem' ||
          loc.region === 'Beirut'
        ) {
          category = Math.random() > 0.4 ? 'conflict' : category;
        }

        // Intensity based on location weight and recency
        const baseIntensity = loc.weight * 10 + Math.random() * 30;
        const intensity = Math.min(100, baseIntensity);

        events.push({
          id: `event-${events.length}`,
          title: `Event in ${loc.region}`,
          summary: `Sample event description for ${loc.region}`,
          lat,
          lng,
          timestamp,
          source: 'Sample Data',
          sourceUrl: 'https://example.com',
          category,
          intensity,
          entities: [loc.region],
          relatedEventIds: [],
        });
      }
    }

    setEvents(events);
    setIsLoading(false);

    // Trigger a few pulse effects for recent events
    const recentEvents = events
      .filter((e) => Date.now() - e.timestamp.getTime() < 3600000)
      .slice(0, 5);

    recentEvents.forEach((event, index) => {
      setTimeout(() => {
        addPulseEvent(event.lat, event.lng, event.intensity);
      }, index * 500);
    });
  }, [setEvents, addPulseEvent, setIsLoading]);

  return { generateSampleEvents };
}
