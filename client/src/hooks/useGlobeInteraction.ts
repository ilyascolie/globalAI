import { useCallback, useRef, useState } from 'react';
import type { ClickPosition, GlobeInteraction } from '../types';

// Configuration for distinguishing tap from drag
const TAP_THRESHOLD_DISTANCE = 10; // pixels - max movement for a tap
const TAP_THRESHOLD_DURATION = 300; // ms - max duration for a tap
const LONG_PRESS_DURATION = 500; // ms - duration for long press

interface InteractionState {
  isInteracting: boolean;
  startTime: number;
  startPosition: ClickPosition | null;
  currentPosition: ClickPosition | null;
}

interface UseGlobeInteractionOptions {
  onTap?: (position: ClickPosition) => void;
  onLongPress?: (position: ClickPosition) => void;
  onDragStart?: (position: ClickPosition) => void;
  onDrag?: (start: ClickPosition, current: ClickPosition) => void;
  onDragEnd?: (interaction: GlobeInteraction) => void;
  globeRef?: React.RefObject<HTMLElement>;
}

interface UseGlobeInteractionReturn {
  handlers: {
    onPointerDown: (e: React.PointerEvent) => void;
    onPointerMove: (e: React.PointerEvent) => void;
    onPointerUp: (e: React.PointerEvent) => void;
    onPointerCancel: (e: React.PointerEvent) => void;
  };
  isInteracting: boolean;
  interactionType: 'none' | 'tap' | 'drag';
}

/**
 * Hook to handle globe interactions, distinguishing between:
 * - Tap (quick click with minimal movement) -> select event
 * - Drag (movement or long duration) -> rotate globe
 * - Long press -> alternative action
 */
export function useGlobeInteraction(
  options: UseGlobeInteractionOptions = {}
): UseGlobeInteractionReturn {
  const { onTap, onLongPress, onDragStart, onDrag, onDragEnd } = options;

  const stateRef = useRef<InteractionState>({
    isInteracting: false,
    startTime: 0,
    startPosition: null,
    currentPosition: null,
  });

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);

  const [isInteracting, setIsInteracting] = useState(false);
  const [interactionType, setInteractionType] = useState<'none' | 'tap' | 'drag'>('none');

  // Calculate distance between two screen positions
  const getDistance = useCallback((p1: ClickPosition, p2: ClickPosition): number => {
    const dx = p2.screenX - p1.screenX;
    const dy = p2.screenY - p1.screenY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  // Convert screen coordinates to lat/lng (placeholder - actual implementation depends on globe library)
  const screenToGeo = useCallback(
    (screenX: number, screenY: number): { lat: number; lng: number } | null => {
      // This will be implemented based on the three-globe library
      // For now, return a placeholder that can be overridden
      // The actual implementation will use raycasting to find the intersection
      // with the globe surface
      return null;
    },
    []
  );

  const createClickPosition = useCallback(
    (e: React.PointerEvent): ClickPosition => {
      const geo = screenToGeo(e.clientX, e.clientY);
      return {
        screenX: e.clientX,
        screenY: e.clientY,
        lat: geo?.lat ?? 0,
        lng: geo?.lng ?? 0,
      };
    },
    [screenToGeo]
  );

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const position = createClickPosition(e);

      stateRef.current = {
        isInteracting: true,
        startTime: Date.now(),
        startPosition: position,
        currentPosition: position,
      };

      isDraggingRef.current = false;
      setIsInteracting(true);
      setInteractionType('none');

      // Set up long press timer
      if (onLongPress) {
        longPressTimerRef.current = setTimeout(() => {
          if (stateRef.current.isInteracting && !isDraggingRef.current) {
            const currentPos = stateRef.current.startPosition;
            if (currentPos) {
              onLongPress(currentPos);
            }
          }
        }, LONG_PRESS_DURATION);
      }
    },
    [createClickPosition, onLongPress]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!stateRef.current.isInteracting || !stateRef.current.startPosition) {
        return;
      }

      const currentPosition = createClickPosition(e);
      stateRef.current.currentPosition = currentPosition;

      const distance = getDistance(stateRef.current.startPosition, currentPosition);

      // If moved beyond threshold, this is a drag, not a tap
      if (distance > TAP_THRESHOLD_DISTANCE && !isDraggingRef.current) {
        isDraggingRef.current = true;
        clearLongPressTimer();
        setInteractionType('drag');

        if (onDragStart) {
          onDragStart(stateRef.current.startPosition);
        }
      }

      // Continue drag callback
      if (isDraggingRef.current && onDrag) {
        onDrag(stateRef.current.startPosition, currentPosition);
      }
    },
    [createClickPosition, getDistance, clearLongPressTimer, onDragStart, onDrag]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent) => {
      clearLongPressTimer();

      if (!stateRef.current.isInteracting || !stateRef.current.startPosition) {
        return;
      }

      const endPosition = createClickPosition(e);
      const duration = Date.now() - stateRef.current.startTime;
      const distance = getDistance(stateRef.current.startPosition, endPosition);

      const interaction: GlobeInteraction = {
        type: isDraggingRef.current ? 'drag' : 'tap',
        startPosition: stateRef.current.startPosition,
        endPosition,
        duration,
        distance,
      };

      // Determine if this was a tap or drag
      if (!isDraggingRef.current && distance <= TAP_THRESHOLD_DISTANCE && duration <= TAP_THRESHOLD_DURATION) {
        // This is a tap
        setInteractionType('tap');
        if (onTap) {
          onTap(stateRef.current.startPosition);
        }
      } else if (isDraggingRef.current) {
        // This was a drag
        if (onDragEnd) {
          onDragEnd(interaction);
        }
      }

      // Reset state
      stateRef.current = {
        isInteracting: false,
        startTime: 0,
        startPosition: null,
        currentPosition: null,
      };
      isDraggingRef.current = false;
      setIsInteracting(false);
      setInteractionType('none');
    },
    [createClickPosition, getDistance, clearLongPressTimer, onTap, onDragEnd]
  );

  const handlePointerCancel = useCallback(() => {
    clearLongPressTimer();

    stateRef.current = {
      isInteracting: false,
      startTime: 0,
      startPosition: null,
      currentPosition: null,
    };
    isDraggingRef.current = false;
    setIsInteracting(false);
    setInteractionType('none');
  }, [clearLongPressTimer]);

  return {
    handlers: {
      onPointerDown: handlePointerDown,
      onPointerMove: handlePointerMove,
      onPointerUp: handlePointerUp,
      onPointerCancel: handlePointerCancel,
    },
    isInteracting,
    interactionType,
  };
}
