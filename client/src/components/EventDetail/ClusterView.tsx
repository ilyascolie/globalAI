import React, { useMemo, useState, useCallback } from 'react';
import type { Event, EventCluster, SortOption } from '../../types';
import styles from './ClusterView.module.css';
import '../../styles/glassmorphism.css';

interface ClusterViewProps {
  cluster: EventCluster;
  onClose?: () => void;
  onEventSelect?: (event: Event) => void;
  onExpandRegion?: (cluster: EventCluster) => void;
  selectedEventId?: string;
}

// Format relative time
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// Get intensity level
function getIntensityLevel(intensity: number): 'low' | 'medium' | 'high' {
  if (intensity < 33) return 'low';
  if (intensity < 66) return 'medium';
  return 'high';
}

// Calculate position for mini map dot (normalized 0-1)
function calculateMapPosition(
  event: Event,
  cluster: EventCluster
): { x: number; y: number } {
  // Calculate bounds of the cluster
  const events = cluster.events;
  if (events.length === 0) return { x: 0.5, y: 0.5 };

  const lats = events.map((e) => e.lat);
  const lngs = events.map((e) => e.lng);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Add padding
  const latPadding = (maxLat - minLat) * 0.1 || 0.1;
  const lngPadding = (maxLng - minLng) * 0.1 || 0.1;

  const normalizedX =
    (event.lng - (minLng - lngPadding)) /
    (maxLng - minLng + 2 * lngPadding || 1);
  const normalizedY =
    1 -
    (event.lat - (minLat - latPadding)) /
      (maxLat - minLat + 2 * latPadding || 1);

  return {
    x: Math.max(0.05, Math.min(0.95, normalizedX)),
    y: Math.max(0.05, Math.min(0.95, normalizedY)),
  };
}

// Sort options configuration
const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'recency', label: 'Recent' },
  { value: 'intensity', label: 'Intensity' },
  { value: 'category', label: 'Category' },
];

// Icons
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const MapPinIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const MapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
    <line x1="8" y1="2" x2="8" y2="18" />
    <line x1="16" y1="6" x2="16" y2="22" />
  </svg>
);

const ZoomInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

const GlobeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

export const ClusterView: React.FC<ClusterViewProps> = ({
  cluster,
  onClose,
  onEventSelect,
  onExpandRegion,
  selectedEventId,
}) => {
  const [sortOption, setSortOption] = useState<SortOption>('recency');
  const [hoveredEventId, setHoveredEventId] = useState<string | null>(null);

  // Sort events based on selected option
  const sortedEvents = useMemo(() => {
    const events = [...cluster.events];

    switch (sortOption) {
      case 'recency':
        return events.sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
      case 'intensity':
        return events.sort((a, b) => b.intensity - a.intensity);
      case 'category':
        return events.sort((a, b) => a.category.localeCompare(b.category));
      default:
        return events;
    }
  }, [cluster.events, sortOption]);

  // Handle event click
  const handleEventClick = useCallback(
    (event: Event) => {
      if (onEventSelect) {
        onEventSelect(event);
      }
    },
    [onEventSelect]
  );

  // Handle expand region
  const handleExpandRegion = useCallback(() => {
    if (onExpandRegion) {
      onExpandRegion(cluster);
    }
  }, [cluster, onExpandRegion]);

  // Format coordinates for display
  const formattedLocation = useMemo(() => {
    const lat = cluster.centerLat.toFixed(2);
    const lng = cluster.centerLng.toFixed(2);
    const latDir = cluster.centerLat >= 0 ? 'N' : 'S';
    const lngDir = cluster.centerLng >= 0 ? 'E' : 'W';
    return `${Math.abs(parseFloat(lat))}°${latDir}, ${Math.abs(parseFloat(lng))}°${lngDir}`;
  }, [cluster.centerLat, cluster.centerLng]);

  return (
    <div className={`${styles.clusterView} glass-panel animate-slideInRight`}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h2 className={styles.title}>
            <FolderIcon className={styles.locationIcon} />
            Event Cluster
            <span className={styles.eventCount}>{cluster.eventCount}</span>
          </h2>
          {onClose && (
            <button
              className="icon-button"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon style={{ width: 16, height: 16 }} />
            </button>
          )}
        </div>
        <div className={styles.location}>
          <MapPinIcon className={styles.locationIcon} />
          {formattedLocation}
        </div>
      </div>

      {/* Sort controls */}
      <div className={styles.sortControls}>
        <span className={styles.sortLabel}>Sort by:</span>
        <div className={styles.sortOptions}>
          {SORT_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`${styles.sortOption} ${
                sortOption === option.value ? styles.sortOptionActive : ''
              }`}
              onClick={() => setSortOption(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mini map showing event positions */}
      <div className={styles.miniMapContainer}>
        <div className={styles.miniMapTitle}>
          <MapIcon style={{ width: 12, height: 12 }} />
          Positions in cluster
        </div>
        <div className={styles.miniMap}>
          {sortedEvents.map((event) => {
            const pos = calculateMapPosition(event, cluster);
            const intensityLevel = getIntensityLevel(event.intensity);
            const isActive =
              event.id === selectedEventId || event.id === hoveredEventId;

            return (
              <div
                key={event.id}
                className={`${styles.miniMapDot} ${
                  isActive ? styles.miniMapDotActive : ''
                }`}
                style={{
                  left: `${pos.x * 100}%`,
                  top: `${pos.y * 100}%`,
                  background: isActive
                    ? 'var(--color-technology)'
                    : `var(--heatmap-${
                        intensityLevel === 'high' ? 'critical' : intensityLevel
                      })`,
                }}
                onClick={() => handleEventClick(event)}
                onMouseEnter={() => setHoveredEventId(event.id)}
                onMouseLeave={() => setHoveredEventId(null)}
                title={event.title}
              />
            );
          })}
        </div>
      </div>

      {/* Event list */}
      <div className={`${styles.eventList} glass-scrollbar`}>
        {sortedEvents.length > 0 ? (
          sortedEvents.map((event) => {
            const intensityLevel = getIntensityLevel(event.intensity);

            return (
              <div
                key={event.id}
                className={`${styles.eventItem} ${
                  event.id === selectedEventId ? styles.eventItemActive : ''
                }`}
                onClick={() => handleEventClick(event)}
                onMouseEnter={() => setHoveredEventId(event.id)}
                onMouseLeave={() => setHoveredEventId(null)}
              >
                {/* Thumbnail */}
                <div className={styles.eventThumbnail}>
                  {event.thumbnailUrl || event.imageUrl ? (
                    <img
                      src={event.thumbnailUrl || event.imageUrl}
                      alt=""
                      className={styles.eventThumbnailImage}
                    />
                  ) : (
                    <div className={styles.eventThumbnailPlaceholder}>
                      <GlobeIcon className={styles.placeholderIcon} />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={styles.eventContent}>
                  <div className={styles.eventHeader}>
                    <h3 className={styles.eventTitle}>{event.title}</h3>
                    <span
                      className={`category-badge category-badge--${event.category}`}
                    >
                      {event.category}
                    </span>
                  </div>
                  <div className={styles.eventMeta}>
                    <span className={styles.eventMetaItem}>
                      <ClockIcon className={styles.metaIcon} />
                      {formatRelativeTime(event.timestamp)}
                    </span>
                    <span className={styles.eventMetaItem}>
                      <span
                        className={`${styles.intensityDot} ${
                          styles[
                            `intensityDot${
                              intensityLevel.charAt(0).toUpperCase() +
                              intensityLevel.slice(1)
                            }`
                          ]
                        }`}
                      />
                      {event.intensity}%
                    </span>
                    <span className={styles.eventMetaItem}>{event.source}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className={styles.emptyState}>
            <FolderIcon className={styles.emptyIcon} />
            <p className={styles.emptyText}>No events in this cluster</p>
          </div>
        )}
      </div>

      {/* Footer with expand button */}
      {onExpandRegion && (
        <div className={styles.footer}>
          <button
            className={`${styles.expandButton} glass-button glass-button--primary`}
            onClick={handleExpandRegion}
          >
            <ZoomInIcon className={styles.expandIcon} />
            Expand region
          </button>
        </div>
      )}
    </div>
  );
};

export default ClusterView;
