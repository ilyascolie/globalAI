import { useState, useEffect, useCallback } from 'react';
import type { Event, EventContext } from '../types';
import { fetchEventContext, fetchLocationContext } from '../services/contextEnrichmentService';

interface UseEventContextOptions {
  enabled?: boolean;
  refetchOnChange?: boolean;
}

interface UseEventContextReturn {
  context: EventContext | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch context enrichment data for an event
 */
export function useEventContext(
  event: Event | null,
  options: UseEventContextOptions = {}
): UseEventContextReturn {
  const { enabled = true, refetchOnChange = true } = options;

  const [context, setContext] = useState<EventContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (!event || !enabled) {
      setContext(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ctx = await fetchEventContext(event);
      setContext(ctx);

      if (ctx.error) {
        setError(ctx.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch context';
      setError(errorMessage);
      setContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [event?.id, enabled]);

  // Fetch context when event changes
  useEffect(() => {
    if (refetchOnChange) {
      fetchContext();
    }
  }, [fetchContext, refetchOnChange]);

  const refetch = useCallback(() => {
    fetchContext();
  }, [fetchContext]);

  return {
    context,
    isLoading,
    error,
    refetch,
  };
}

/**
 * Hook to fetch context for a geographic location
 */
export function useLocationContext(
  lat: number | null,
  lng: number | null,
  options: UseEventContextOptions = {}
): UseEventContextReturn {
  const { enabled = true, refetchOnChange = true } = options;

  const [context, setContext] = useState<EventContext | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchContext = useCallback(async () => {
    if (lat === null || lng === null || !enabled) {
      setContext(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const ctx = await fetchLocationContext(lat, lng);
      setContext(ctx);

      if (ctx.error) {
        setError(ctx.error);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch context';
      setError(errorMessage);
      setContext(null);
    } finally {
      setIsLoading(false);
    }
  }, [lat, lng, enabled]);

  // Fetch context when location changes
  useEffect(() => {
    if (refetchOnChange) {
      fetchContext();
    }
  }, [fetchContext, refetchOnChange]);

  const refetch = useCallback(() => {
    fetchContext();
  }, [fetchContext]);

  return {
    context,
    isLoading,
    error,
    refetch,
  };
}
