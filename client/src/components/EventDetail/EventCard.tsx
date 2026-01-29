import React, { useEffect, useState, useCallback } from 'react';
import type { Event, EventContext, EventCategory } from '../../types';
import { fetchEventContext } from '../../services/contextEnrichmentService';
import { formatPopulation } from '../../services/countryService';
import { formatHistoricalSummary } from '../../services/historicalContextService';
import styles from './EventCard.module.css';
import '../../styles/glassmorphism.css';

interface EventCardProps {
  event: Event;
  onClose?: () => void;
  onReadMore?: (url: string) => void;
  onShare?: (shareUrl: string) => void;
  onRelatedClick?: (eventId: string) => void;
  showContext?: boolean;
}

// Format relative time (e.g., "2 hours ago")
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'just now';
  if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString();
}

// Get intensity level for styling
function getIntensityLevel(intensity: number): 'low' | 'medium' | 'high' {
  if (intensity < 33) return 'low';
  if (intensity < 66) return 'medium';
  return 'high';
}

// Generate share URL with lat/long encoded
function generateShareUrl(event: Event): string {
  const baseUrl = window.location.origin;
  const params = new URLSearchParams({
    event: event.id,
    lat: event.lat.toFixed(4),
    lng: event.lng.toFixed(4),
  });
  return `${baseUrl}?${params.toString()}`;
}

// Icons as SVG components
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);

const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <path d="M12 6v6l4 2" />
  </svg>
);

const SourceIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const ExternalLinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15,3 21,3 21,9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

const ShareIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
  </svg>
);

const GlobeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
  </svg>
);

const WikipediaIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12.09 13.119c-.936 1.932-2.217 4.548-2.853 5.728-.616 1.074-1.127.931-1.532.029-1.406-3.321-4.293-9.144-5.651-12.409-.251-.601-.441-.987-.619-1.139-.181-.15-.554-.24-1.122-.271C.103 5.033 0 4.982 0 4.898v-.455l.052-.045c.924-.005 5.401 0 5.401 0l.051.045v.434c0 .119-.075.176-.225.176l-.564.031c-.485.029-.727.164-.727.436 0 .135.053.33.166.601 1.082 2.646 4.818 10.521 4.818 10.521l.136.046 2.411-4.81-.482-1.067-1.658-3.264s-.318-.654-.428-.872c-.728-1.443-.712-1.518-1.447-1.617-.207-.023-.313-.05-.313-.149v-.468l.06-.045h4.292l.113.037v.451c0 .105-.076.15-.227.15l-.308.047c-.792.061-.661.381-.136 1.422l1.582 3.252 1.758-3.504c.293-.64.233-.801.111-.947-.07-.084-.305-.22-.812-.24l-.201-.021c-.052 0-.098-.015-.145-.051-.045-.031-.067-.076-.067-.129v-.427l.061-.045c1.247-.008 4.043 0 4.043 0l.059.045v.436c0 .121-.059.178-.193.178-.646.03-.782.095-1.023.439-.12.186-.375.589-.646 1.039l-2.301 4.273-.065.135 2.792 5.712.17.048 4.396-10.438c.154-.422.129-.722-.064-.895-.197-.172-.346-.273-.857-.295l-.42-.016c-.061 0-.105-.014-.152-.045-.043-.029-.072-.075-.072-.119v-.436l.059-.045h4.961l.041.045v.437c0 .119-.074.18-.209.18-.648.03-1.127.18-1.443.421-.314.255-.557.616-.736 1.067 0 0-4.043 9.258-5.426 12.339-.525 1.007-1.053.917-1.503-.031-.571-1.171-1.773-3.786-2.646-5.71l.053-.036z" />
  </svg>
);

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onClose,
  onReadMore,
  onShare,
  onRelatedClick,
  showContext = true,
}) => {
  const [context, setContext] = useState<EventContext | null>(null);
  const [isLoading, setIsLoading] = useState(showContext);
  const [showToast, setShowToast] = useState(false);

  // Fetch context enrichment data
  useEffect(() => {
    if (!showContext) return;

    let cancelled = false;

    const loadContext = async () => {
      setIsLoading(true);
      try {
        const ctx = await fetchEventContext(event);
        if (!cancelled) {
          setContext(ctx);
        }
      } catch (error) {
        console.error('Failed to load context:', error);
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadContext();

    return () => {
      cancelled = true;
    };
  }, [event.id, showContext]);

  // Handle read more click
  const handleReadMore = useCallback(() => {
    if (onReadMore) {
      onReadMore(event.sourceUrl);
    } else {
      window.open(event.sourceUrl, '_blank', 'noopener,noreferrer');
    }
  }, [event.sourceUrl, onReadMore]);

  // Handle share click
  const handleShare = useCallback(async () => {
    const shareUrl = generateShareUrl(event);

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 2000);

      if (onShare) {
        onShare(shareUrl);
      }
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
    }
  }, [event, onShare]);

  const intensityLevel = getIntensityLevel(event.intensity);

  return (
    <div className={`${styles.eventCard} glass-panel animate-slideInRight`}>
      {/* Close button */}
      {onClose && (
        <button
          className={`${styles.closeButton} icon-button`}
          onClick={onClose}
          aria-label="Close"
        >
          <CloseIcon className={styles.actionIcon} />
        </button>
      )}

      {/* Thumbnail */}
      <div className={styles.thumbnail}>
        {event.thumbnailUrl || event.imageUrl ? (
          <img
            src={event.thumbnailUrl || event.imageUrl}
            alt={event.title}
            className={styles.thumbnailImage}
          />
        ) : (
          <div className={styles.thumbnailPlaceholder}>
            <GlobeIcon className={styles.thumbnailIcon} />
          </div>
        )}
        <div className={styles.thumbnailOverlay}>
          <span className={`category-badge category-badge--${event.category}`}>
            {event.category}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        {/* Headline */}
        <h2 className={styles.headline}>{event.title}</h2>

        {/* Meta info */}
        <div className={styles.meta}>
          <span className={styles.metaItem}>
            <ClockIcon className={styles.metaIcon} />
            {formatRelativeTime(event.timestamp)}
          </span>
          <span className={`${styles.metaItem} ${styles.source}`}>
            <SourceIcon className={styles.metaIcon} />
            {event.source}
          </span>
        </div>

        {/* Summary */}
        <p className={styles.summary}>{event.summary}</p>

        {/* Intensity bar */}
        <div className={styles.intensitySection}>
          <div className={styles.intensityLabel}>
            <span>Intensity</span>
            <span>{event.intensity}%</span>
          </div>
          <div className="intensity-bar">
            <div
              className={`intensity-bar__fill intensity-bar__fill--${intensityLevel}`}
              style={{ width: `${event.intensity}%` }}
            />
          </div>
        </div>

        {/* Entity tags */}
        {event.entities.length > 0 && (
          <div className={styles.entities}>
            {event.entities.slice(0, 5).map((entity, idx) => (
              <span
                key={idx}
                className={styles.entityTag}
                onClick={() => onRelatedClick?.(entity)}
              >
                {entity}
              </span>
            ))}
          </div>
        )}

        {/* Context enrichment section */}
        {showContext && (
          <div className={styles.contextSection}>
            {isLoading ? (
              <div className={styles.loading}>
                <div className="skeleton skeleton--text" />
                <div className={styles.loadingRow}>
                  <div className="skeleton skeleton--text" style={{ width: '60%' }} />
                </div>
              </div>
            ) : context ? (
              <>
                {/* Country info */}
                {context.countryInfo && (
                  <>
                    <div className={styles.contextTitle}>
                      <GlobeIcon className={styles.metaIcon} />
                      Location
                    </div>
                    <div className={styles.countryInfo}>
                      <span className={styles.countryFlag}>
                        {context.countryInfo.flag}
                      </span>
                      <div className={styles.countryDetails}>
                        <div className={styles.countryName}>
                          {context.countryInfo.name}
                        </div>
                        <div className={styles.countryStats}>
                          <span>Capital: {context.countryInfo.capital}</span>
                          <span>Pop: {formatPopulation(context.countryInfo.population)}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Historical context */}
                {context.historicalContext && (
                  <div className={styles.historicalContext}>
                    {formatHistoricalSummary(context.historicalContext)}
                  </div>
                )}

                {/* Wikipedia summary */}
                {context.locationSummary && (
                  <div className={styles.wikiSummary}>
                    <div className={styles.wikiHeader}>
                      <WikipediaIcon className={styles.wikiLogo} />
                      <span className={styles.wikiTitle}>
                        {context.locationSummary.title}
                      </span>
                    </div>
                    <p className={styles.wikiText}>
                      {context.locationSummary.extract}
                    </p>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        {/* Action buttons */}
        <div className={styles.actions}>
          <button
            className={`${styles.actionButton} glass-button glass-button--primary`}
            onClick={handleReadMore}
          >
            <ExternalLinkIcon className={styles.actionIcon} />
            Read more
          </button>
          <button
            className={`${styles.actionButton} glass-button`}
            onClick={handleShare}
          >
            <ShareIcon className={styles.actionIcon} />
            Share
          </button>
        </div>
      </div>

      {/* Toast notification */}
      {showToast && (
        <div className={styles.toast}>
          Link copied to clipboard!
        </div>
      )}
    </div>
  );
};

export default EventCard;
