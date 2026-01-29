import React, { useEffect, useState, useCallback } from 'react';
import { useEventSelectionStore, selectCurrentEvent, selectCurrentCluster } from '../../stores/eventSelectionStore';
import { EventCard } from './EventCard';
import { ClusterView } from './ClusterView';
import { RelatedEvents } from './RelatedEvents';
import type { Event } from '../../types';
import styles from './EventDetailPanel.module.css';
import '../../styles/glassmorphism.css';

interface EventDetailPanelProps {
  onZoomToLocation?: (lat: number, lng: number, zoom?: number) => void;
  fetchRelatedEvents?: (eventId: string) => Promise<Event[]>;
}

export const EventDetailPanel: React.FC<EventDetailPanelProps> = ({
  onZoomToLocation,
  fetchRelatedEvents,
}) => {
  const {
    selection,
    isOpen,
    clearSelection,
    selectEventFromCluster,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
  } = useEventSelectionStore();

  const currentEvent = useEventSelectionStore(selectCurrentEvent);
  const currentCluster = useEventSelectionStore(selectCurrentCluster);

  const [relatedEvents, setRelatedEvents] = useState<Event[]>([]);
  const [isLoadingRelated, setIsLoadingRelated] = useState(false);

  // Fetch related events when a single event is selected
  useEffect(() => {
    if (currentEvent && fetchRelatedEvents) {
      let cancelled = false;
      setIsLoadingRelated(true);

      fetchRelatedEvents(currentEvent.id)
        .then((events) => {
          if (!cancelled) {
            setRelatedEvents(events);
          }
        })
        .catch(console.error)
        .finally(() => {
          if (!cancelled) {
            setIsLoadingRelated(false);
          }
        });

      return () => {
        cancelled = true;
      };
    } else {
      setRelatedEvents([]);
    }
  }, [currentEvent?.id, fetchRelatedEvents]);

  // Handle close
  const handleClose = useCallback(() => {
    clearSelection();
  }, [clearSelection]);

  // Handle read more
  const handleReadMore = useCallback((url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  }, []);

  // Handle share
  const handleShare = useCallback((shareUrl: string) => {
    console.log('Shared:', shareUrl);
  }, []);

  // Handle expand region (zoom in on globe)
  const handleExpandRegion = useCallback(() => {
    if (selection && onZoomToLocation) {
      onZoomToLocation(selection.position.lat, selection.position.lng, 5);
    }
  }, [selection, onZoomToLocation]);

  // Handle event selection from cluster
  const handleClusterEventSelect = useCallback(
    (event: Event) => {
      selectEventFromCluster(event);
    },
    [selectEventFromCluster]
  );

  // Handle related event click
  const handleRelatedEventClick = useCallback(
    (event: Event) => {
      selectEventFromCluster(event);
    },
    [selectEventFromCluster]
  );

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        handleClose();
      } else if (e.key === 'ArrowLeft' && canGoBack()) {
        goBack();
      } else if (e.key === 'ArrowRight' && canGoForward()) {
        goForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose, goBack, goForward, canGoBack, canGoForward]);

  if (!isOpen || !selection) {
    return null;
  }

  return (
    <div className={styles.panel}>
      {/* Navigation buttons */}
      {(canGoBack() || canGoForward()) && (
        <div className={styles.navigation}>
          <button
            className={`${styles.navButton} icon-button`}
            onClick={goBack}
            disabled={!canGoBack()}
            aria-label="Go back"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <button
            className={`${styles.navButton} icon-button`}
            onClick={goForward}
            disabled={!canGoForward()}
            aria-label="Go forward"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}

      {/* Content based on selection type */}
      {selection.type === 'single' && currentEvent ? (
        <div className={styles.content}>
          <EventCard
            event={currentEvent}
            onClose={handleClose}
            onReadMore={handleReadMore}
            onShare={handleShare}
            showContext={true}
          />

          {/* Related events carousel */}
          {(relatedEvents.length > 0 || isLoadingRelated) && (
            <div className={styles.relatedSection}>
              <RelatedEvents
                events={relatedEvents}
                currentEventId={currentEvent.id}
                onEventClick={handleRelatedEventClick}
                isLoading={isLoadingRelated}
                visibleCount={2}
              />
            </div>
          )}
        </div>
      ) : selection.type === 'cluster' && currentCluster ? (
        <ClusterView
          cluster={currentCluster}
          onClose={handleClose}
          onEventSelect={handleClusterEventSelect}
          onExpandRegion={handleExpandRegion}
        />
      ) : null}
    </div>
  );
};

export default EventDetailPanel;
