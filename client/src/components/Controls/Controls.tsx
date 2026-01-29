import { useStore } from '../../stores/useStore';
import type { ViewMode, PredictionCategory } from '../../types';
import './Controls.css';

const PREDICTION_CATEGORIES: { value: PredictionCategory; label: string }[] = [
  { value: 'election', label: 'Elections' },
  { value: 'geopolitical', label: 'Geopolitical' },
  { value: 'disaster', label: 'Disasters' },
  { value: 'economic', label: 'Economic' },
  { value: 'other', label: 'Other' },
];

export function Controls() {
  const { mode, setMode, filters, setFilters, predictions, isLoading } = useStore();

  const handleModeChange = (newMode: ViewMode) => {
    setMode(newMode);
    setFilters({ mode: newMode });
  };

  const handleCategoryToggle = (category: PredictionCategory) => {
    const current = filters.categories as string[];
    if (current.includes(category)) {
      setFilters({ categories: current.filter((c) => c !== category) });
    } else {
      setFilters({ categories: [...current, category] });
    }
  };

  const formatVolume = (volume: number): string => {
    if (volume >= 1000000) return `$${(volume / 1000000).toFixed(1)}M`;
    if (volume >= 1000) return `$${(volume / 1000).toFixed(0)}K`;
    return `$${volume}`;
  };

  return (
    <div className="controls glass-card">
      {/* Mode Toggle */}
      <div className="control-section">
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'news' ? 'active news' : ''}`}
            onClick={() => handleModeChange('news')}
          >
            <span className="mode-icon">N</span>
            News
          </button>
          <button
            className={`mode-btn ${mode === 'predictions' ? 'active predictions' : ''}`}
            onClick={() => handleModeChange('predictions')}
          >
            <span className="mode-icon">P</span>
            Predictions
          </button>
          <button
            className={`mode-btn ${mode === 'combined' ? 'active combined' : ''}`}
            onClick={() => handleModeChange('combined')}
          >
            <span className="mode-icon">+</span>
            Combined
          </button>
        </div>
      </div>

      {/* Predictions Filters */}
      {(mode === 'predictions' || mode === 'combined') && (
        <>
          <div className="control-section">
            <label className="control-label">Probability Range</label>
            <div className="range-inputs">
              <input
                type="range"
                min="0"
                max="100"
                value={filters.minProbability * 100}
                onChange={(e) => setFilters({ minProbability: parseInt(e.target.value) / 100 })}
                className="range-slider"
              />
              <span className="range-value">
                {Math.round(filters.minProbability * 100)}% - {Math.round(filters.maxProbability * 100)}%
              </span>
            </div>
          </div>

          <div className="control-section">
            <label className="control-label">Min Volume</label>
            <select
              value={filters.minVolume}
              onChange={(e) => setFilters({ minVolume: parseInt(e.target.value) })}
              className="control-select"
            >
              <option value="0">Any</option>
              <option value="1000">$1K+</option>
              <option value="10000">$10K+</option>
              <option value="50000">$50K+</option>
              <option value="100000">$100K+</option>
              <option value="500000">$500K+</option>
            </select>
          </div>

          <div className="control-section">
            <label className="control-label">Categories</label>
            <div className="category-chips">
              {PREDICTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`category-chip ${
                    filters.categories.includes(cat.value) ? 'active' : ''
                  }`}
                  onClick={() => handleCategoryToggle(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="control-section">
            <label className="control-toggle">
              <input
                type="checkbox"
                checked={filters.closingSoon}
                onChange={(e) => setFilters({ closingSoon: e.target.checked })}
              />
              <span className="toggle-label">Closing Soon (&lt;24h)</span>
              <span className="toggle-indicator glow" />
            </label>
          </div>
        </>
      )}

      {/* Stats */}
      <div className="control-section stats">
        <div className="stat">
          <span className="stat-value">{predictions.length}</span>
          <span className="stat-label">Markets</span>
        </div>
        {isLoading && <div className="loading-dot pulse" />}
      </div>
    </div>
  );
}
