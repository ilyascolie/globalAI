import { useStore } from '../../stores/useStore';
import type { Prediction, Event } from '../../types';
import './EventPanel.css';

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatVolume(volume: number): string {
  if (volume >= 1000000) return `$${(volume / 1000000).toFixed(2)}M`;
  if (volume >= 1000) return `$${(volume / 1000).toFixed(1)}K`;
  return `$${volume.toFixed(0)}`;
}

function formatProbability(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

function getTimeRemaining(endDate: Date): string {
  const now = new Date();
  const end = new Date(endDate);
  const diff = end.getTime() - now.getTime();

  if (diff < 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  if (hours > 0) return `${hours}h remaining`;

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return `${minutes}m remaining`;
}

function PredictionDetails({ prediction }: { prediction: Prediction }) {
  const timeRemaining = getTimeRemaining(prediction.endDate);
  const isClosingSoon = prediction.closingSoon;

  return (
    <div className="panel-content prediction-content">
      <div className="panel-header">
        <span className={`category-badge ${prediction.category}`}>
          {prediction.category}
        </span>
        {isClosingSoon && <span className="closing-badge glow">Closing Soon</span>}
      </div>

      <h2 className="panel-title">{prediction.question}</h2>

      <div className="probability-display">
        <div className="probability-bar">
          <div
            className="probability-fill"
            style={{ width: `${prediction.probability * 100}%` }}
          />
        </div>
        <div className="probability-labels">
          <span>No</span>
          <span className="probability-value">
            {formatProbability(prediction.probability)}
          </span>
          <span>Yes</span>
        </div>
      </div>

      <div className="outcomes-list">
        {prediction.outcomes.map((outcome, idx) => (
          <div key={idx} className="outcome-row">
            <span className="outcome-name">{outcome.name}</span>
            <span className="outcome-prob">{formatProbability(outcome.probability)}</span>
          </div>
        ))}
      </div>

      <div className="panel-stats">
        <div className="stat-item">
          <span className="stat-label">Volume</span>
          <span className="stat-value">{formatVolume(prediction.volume)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">End Date</span>
          <span className="stat-value">{formatDate(prediction.endDate)}</span>
        </div>
        <div className="stat-item">
          <span className={`stat-label ${isClosingSoon ? 'urgent' : ''}`}>Time Left</span>
          <span className={`stat-value ${isClosingSoon ? 'urgent' : ''}`}>
            {timeRemaining}
          </span>
        </div>
      </div>

      <div className="locations-list">
        <span className="locations-label">Locations</span>
        <div className="locations-tags">
          {prediction.locations.map((loc, idx) => (
            <span key={idx} className="location-tag">
              {loc.name}
              <span className="confidence">({Math.round(loc.confidence * 100)}%)</span>
            </span>
          ))}
        </div>
      </div>

      <a
        href={prediction.url}
        target="_blank"
        rel="noopener noreferrer"
        className="polymarket-link"
      >
        View on Polymarket
        <span className="link-arrow">-></span>
      </a>
    </div>
  );
}

function EventDetails({ event }: { event: Event }) {
  return (
    <div className="panel-content event-content">
      <div className="panel-header">
        <span className={`category-badge ${event.category}`}>{event.category}</span>
      </div>

      <h2 className="panel-title">{event.title}</h2>

      <p className="event-summary">{event.summary}</p>

      <div className="panel-stats">
        <div className="stat-item">
          <span className="stat-label">Source</span>
          <span className="stat-value">{event.source}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Time</span>
          <span className="stat-value">{formatDate(event.timestamp)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Intensity</span>
          <span className="stat-value intensity-bar">
            <span
              className="intensity-fill"
              style={{ width: `${event.intensity}%` }}
            />
            {event.intensity}
          </span>
        </div>
      </div>

      {event.entities.length > 0 && (
        <div className="entities-list">
          <span className="entities-label">Entities</span>
          <div className="entity-tags">
            {event.entities.map((entity, idx) => (
              <span key={idx} className="entity-tag">
                {entity}
              </span>
            ))}
          </div>
        </div>
      )}

      <a
        href={event.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="source-link"
      >
        Read Full Article
        <span className="link-arrow">-></span>
      </a>
    </div>
  );
}

export function EventPanel() {
  const {
    selectedPrediction,
    selectedEvent,
    setSelectedPrediction,
    setSelectedEvent,
    isPanelOpen,
    setIsPanelOpen,
  } = useStore();

  const handleClose = () => {
    setSelectedPrediction(null);
    setSelectedEvent(null);
    setIsPanelOpen(false);
  };

  if (!isPanelOpen || (!selectedPrediction && !selectedEvent)) {
    return null;
  }

  return (
    <div className="event-panel glass-card">
      <button className="close-btn" onClick={handleClose}>
        x
      </button>

      {selectedPrediction && <PredictionDetails prediction={selectedPrediction} />}
      {selectedEvent && <EventDetails event={selectedEvent} />}
    </div>
  );
}
