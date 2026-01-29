import { usePredictionStore } from '../../stores/usePredictionStore';
import './PredictionPanel.css';

export function PredictionPanel() {
  const { selectedPrediction, setSelectedPrediction } = usePredictionStore();

  if (!selectedPrediction) {
    return null;
  }

  const handleClose = () => {
    setSelectedPrediction(null);
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume.toFixed(0)}`;
  };

  const formatDate = (date: Date): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (endDate: Date): string => {
    const now = new Date();
    const end = new Date(endDate);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) return 'Closed';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h`;
    return 'Closing soon';
  };

  return (
    <div className="prediction-panel">
      <button className="close-btn" onClick={handleClose}>
        &times;
      </button>

      <div className="panel-content">
        {/* Header */}
        <div className="panel-header">
          <span className={`category-badge ${selectedPrediction.category}`}>
            {selectedPrediction.category}
          </span>
          {selectedPrediction.closingSoon && (
            <span className="closing-badge">Closing Soon</span>
          )}
        </div>

        {/* Question */}
        <h2 className="panel-title">{selectedPrediction.question}</h2>

        {/* Probability Display */}
        <div className="probability-display">
          <div className="probability-bar">
            <div
              className="probability-fill"
              style={{ width: `${selectedPrediction.probability * 100}%` }}
            />
          </div>
          <div className="probability-labels">
            <span>0%</span>
            <span className="probability-value">
              {(selectedPrediction.probability * 100).toFixed(1)}%
            </span>
            <span>100%</span>
          </div>
        </div>

        {/* Outcomes */}
        <div className="outcomes-list">
          {selectedPrediction.outcomes.map((outcome) => (
            <div key={outcome.name} className="outcome-row">
              <span className="outcome-name">{outcome.name}</span>
              <span className="outcome-prob">
                {(outcome.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="panel-stats">
          <div className="stat-item">
            <span className="stat-label">Volume</span>
            <span className="stat-value">{formatVolume(selectedPrediction.volume)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">End Date</span>
            <span className="stat-value">{formatDate(selectedPrediction.endDate)}</span>
          </div>
          <div className="stat-item">
            <span className={`stat-label ${selectedPrediction.closingSoon ? 'urgent' : ''}`}>
              Time Left
            </span>
            <span className={`stat-value ${selectedPrediction.closingSoon ? 'urgent' : ''}`}>
              {getTimeRemaining(selectedPrediction.endDate)}
            </span>
          </div>
        </div>

        {/* Locations */}
        <div className="locations-list">
          <span className="locations-label">Locations</span>
          <div className="locations-tags">
            {selectedPrediction.locations.map((loc, idx) => (
              <span key={idx} className="location-tag">
                {loc.name}
                <span className="confidence">
                  {Math.round(loc.confidence * 100)}%
                </span>
              </span>
            ))}
          </div>
        </div>

        {/* Link to Polymarket */}
        <a
          href={selectedPrediction.url}
          target="_blank"
          rel="noopener noreferrer"
          className="polymarket-link"
        >
          Trade on Polymarket
          <span className="link-arrow">&rarr;</span>
        </a>
      </div>
    </div>
  );
}
