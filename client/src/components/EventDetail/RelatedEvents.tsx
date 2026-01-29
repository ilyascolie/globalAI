import React, { useState, useCallback, useMemo, useRef, useEffect } from 'react';
import type { Event } from '../../types';
import styles from './RelatedEvents.module.css';
import '../../styles/glassmorphism.css';

interface RelatedEventsProps {
  events: Event[];
  currentEventId?: string;
  onEventClick?: (event: Event) => void;
  isLoading?: boolean;
  visibleCount?: number;
}

// Format relative time short version
function formatTimeShort(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  return `${diffDays}d`;
}

// Icons
const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const GlobeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

export const RelatedEvents: React.FC<RelatedEventsProps> = ({
  events,
  currentEventId,
  onEventClick,
  isLoading = false,
  visibleCount = 2,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [translateX, setTranslateX] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);

  // Card dimensions
  const cardWidth = 160;
  const gap = 8;
  const slideWidth = cardWidth + gap;

  // Calculate max index based on visible count
  const maxIndex = Math.max(0, events.length - visibleCount);

  // Total dots needed
  const dotsCount = Math.ceil(events.length / visibleCount);

  // Navigate to previous
  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  }, []);

  // Navigate to next
  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => Math.min(maxIndex, prev + 1));
  }, [maxIndex]);

  // Navigate to specific dot
  const goToDot = useCallback(
    (dotIndex: number) => {
      const targetIndex = Math.min(dotIndex * visibleCount, maxIndex);
      setCurrentIndex(targetIndex);
    },
    [maxIndex, visibleCount]
  );

  // Handle drag start
  const handleDragStart = useCallback((clientX: number) => {
    setIsDragging(true);
    setStartX(clientX);
  }, []);

  // Handle drag move
  const handleDragMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      const diff = clientX - startX;
      setTranslateX(diff);
    },
    [isDragging, startX]
  );

  // Handle drag end
  const handleDragEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);

    // Determine if we should slide
    const threshold = slideWidth / 3;

    if (translateX > threshold) {
      goToPrev();
    } else if (translateX < -threshold) {
      goToNext();
    }

    setTranslateX(0);
  }, [isDragging, translateX, slideWidth, goToPrev, goToNext]);

  // Mouse event handlers
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleDragStart(e.clientX);
    },
    [handleDragStart]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      handleDragMove(e.clientX);
    },
    [handleDragMove]
  );

  const handleMouseUp = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Touch event handlers
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      handleDragStart(e.touches[0].clientX);
    },
    [handleDragStart]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      handleDragMove(e.touches[0].clientX);
    },
    [handleDragMove]
  );

  const handleTouchEnd = useCallback(() => {
    handleDragEnd();
  }, [handleDragEnd]);

  // Clean up mouse events on document level
  useEffect(() => {
    if (isDragging) {
      const handleGlobalMouseUp = () => handleDragEnd();
      const handleGlobalMouseMove = (e: MouseEvent) => handleDragMove(e.clientX);

      document.addEventListener('mouseup', handleGlobalMouseUp);
      document.addEventListener('mousemove', handleGlobalMouseMove);

      return () => {
        document.removeEventListener('mouseup', handleGlobalMouseUp);
        document.removeEventListener('mousemove', handleGlobalMouseMove);
      };
    }
  }, [isDragging, handleDragEnd, handleDragMove]);

  // Calculate transform
  const transform = useMemo(() => {
    const baseTransform = -currentIndex * slideWidth;
    return baseTransform + translateX;
  }, [currentIndex, slideWidth, translateX]);

  // Current dot index
  const currentDotIndex = Math.floor(currentIndex / visibleCount);

  // Handle event click with drag check
  const handleEventClick = useCallback(
    (event: Event, e: React.MouseEvent) => {
      // Don't trigger click if we were dragging
      if (Math.abs(translateX) > 5) {
        e.preventDefault();
        return;
      }

      if (onEventClick) {
        onEventClick(event);
      }
    },
    [onEventClick, translateX]
  );

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.relatedEvents}>
        <div className={styles.header}>
          <h4 className={styles.title}>
            <LinkIcon className={styles.titleIcon} />
            Related Events
          </h4>
        </div>
        <div className={styles.loading}>
          {Array.from({ length: visibleCount }).map((_, i) => (
            <div key={i} className={`${styles.loadingCard} skeleton`} />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (events.length === 0) {
    return (
      <div className={styles.relatedEvents}>
        <div className={styles.header}>
          <h4 className={styles.title}>
            <LinkIcon className={styles.titleIcon} />
            Related Events
          </h4>
        </div>
        <div className={styles.empty}>No related events found</div>
      </div>
    );
  }

  return (
    <div className={styles.relatedEvents}>
      {/* Header with controls */}
      <div className={styles.header}>
        <h4 className={styles.title}>
          <LinkIcon className={styles.titleIcon} />
          Related Events
        </h4>
        {events.length > visibleCount && (
          <div className={styles.controls}>
            <button
              className={styles.controlButton}
              onClick={goToPrev}
              disabled={currentIndex === 0}
              aria-label="Previous"
            >
              <ChevronLeftIcon className={styles.controlIcon} />
            </button>
            <button
              className={styles.controlButton}
              onClick={goToNext}
              disabled={currentIndex >= maxIndex}
              aria-label="Next"
            >
              <ChevronRightIcon className={styles.controlIcon} />
            </button>
          </div>
        )}
      </div>

      {/* Carousel */}
      <div
        className={styles.carousel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          ref={trackRef}
          className={`${styles.carouselTrack} ${
            isDragging ? styles.carouselTrackDragging : ''
          }`}
          style={{ transform: `translateX(${transform}px)` }}
        >
          {events.map((event) => (
            <div
              key={event.id}
              className={`${styles.eventCard} ${
                event.id === currentEventId ? styles.eventCardActive : ''
              }`}
              onClick={(e) => handleEventClick(event, e)}
            >
              {/* Thumbnail */}
              <div className={styles.cardThumbnail}>
                {event.thumbnailUrl || event.imageUrl ? (
                  <img
                    src={event.thumbnailUrl || event.imageUrl}
                    alt=""
                    className={styles.cardThumbnailImage}
                    draggable={false}
                  />
                ) : (
                  <div className={styles.cardThumbnailPlaceholder}>
                    <GlobeIcon className={styles.placeholderIcon} />
                  </div>
                )}
              </div>

              {/* Content */}
              <div className={styles.cardContent}>
                <span
                  className={`${styles.cardCategory} category-badge category-badge--${event.category}`}
                >
                  {event.category}
                </span>
                <h5 className={styles.cardTitle}>{event.title}</h5>
                <div className={styles.cardMeta}>
                  <ClockIcon className={styles.metaIcon} />
                  {formatTimeShort(event.timestamp)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {dotsCount > 1 && (
        <div className={styles.dots}>
          {Array.from({ length: dotsCount }).map((_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${
                i === currentDotIndex ? styles.dotActive : ''
              }`}
              onClick={() => goToDot(i)}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default RelatedEvents;
