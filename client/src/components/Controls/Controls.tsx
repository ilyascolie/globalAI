import { useCallback } from 'react';
import { useHeatmapStore } from '../../stores/useHeatmapStore';
import { usePredictionStore } from '../../stores/usePredictionStore';
import type { EventCategory, TimeRange, ViewMode, PredictionCategory } from '../../types';
import './Controls.css';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
];

const EVENT_CATEGORIES: { value: EventCategory; label: string; color: string }[] = [
  { value: 'conflict', label: 'Conflict', color: '#ef4444' },
  { value: 'politics', label: 'Politics', color: '#8b5cf6' },
  { value: 'disaster', label: 'Disaster', color: '#f97316' },
  { value: 'economics', label: 'Economics', color: '#22c55e' },
  { value: 'health', label: 'Health', color: '#06b6d4' },
  { value: 'technology', label: 'Technology', color: '#3b82f6' },
  { value: 'environment', label: 'Environment', color: '#84cc16' },
];

const PREDICTION_CATEGORIES: { value: PredictionCategory; label: string }[] = [
  { value: 'election', label: 'Elections' },
  { value: 'geopolitical', label: 'Geopolitical' },
  { value: 'disaster', label: 'Disasters' },
  { value: 'economic', label: 'Economic' },
  { value: 'other', label: 'Other' },
];

interface ControlsProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
}

export function Controls({ mode, onModeChange }: ControlsProps) {
  const {
    filters: newsFilters,
    setTimeRange,
    toggleCategory: toggleNewsCategory,
    config,
    setOpacity,
    setSensitivity,
    hotSpots,
  } = useHeatmapStore();

  const {
    filters: predictionFilters,
    setFilters: setPredictionFilters,
    toggleCategory: togglePredictionCategory,
    predictions,
  } = usePredictionStore();

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      setTimeRange(range);
    },
    [setTimeRange]
  );

  const handleNewsCategory = useCallback(
    (category: EventCategory) => {
      toggleNewsCategory(category);
    },
    [toggleNewsCategory]
  );

  const handlePredictionCategory = useCallback(
    (category: PredictionCategory) => {
      togglePredictionCategory(category);
    },
    [togglePredictionCategory]
  );

  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setOpacity(parseFloat(e.target.value));
    },
    [setOpacity]
  );

  const handleSensitivityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setSensitivity(parseFloat(e.target.value));
    },
    [setSensitivity]
  );

  return (
    <div className="controls">
      {/* Header */}
      <div className="controls-header">
        <h1 className="controls-title">Global Events</h1>
        <p className="controls-subtitle">News & Predictions</p>
      </div>

      {/* Mode Toggle */}
      <section className="controls-section">
        <h2 className="section-title">View Mode</h2>
        <div className="mode-toggle">
          <button
            className={`mode-btn ${mode === 'news' ? 'active news' : ''}`}
            onClick={() => onModeChange('news')}
          >
            News
          </button>
          <button
            className={`mode-btn ${mode === 'predictions' ? 'active predictions' : ''}`}
            onClick={() => onModeChange('predictions')}
          >
            Markets
          </button>
          <button
            className={`mode-btn ${mode === 'combined' ? 'active combined' : ''}`}
            onClick={() => onModeChange('combined')}
          >
            Both
          </button>
        </div>
      </section>

      {/* News Controls */}
      {(mode === 'news' || mode === 'combined') && (
        <>
          <section className="controls-section">
            <h2 className="section-title">Time Range</h2>
            <div className="time-range-buttons">
              {TIME_RANGES.map(({ value, label }) => (
                <button
                  key={value}
                  className={`time-range-btn ${newsFilters.timeRange === value ? 'active' : ''}`}
                  onClick={() => handleTimeRangeChange(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="controls-section">
            <h2 className="section-title">News Categories</h2>
            <div className="category-toggles">
              {EVENT_CATEGORIES.map(({ value, label, color }) => (
                <label key={value} className="category-toggle">
                  <input
                    type="checkbox"
                    checked={newsFilters.categories.has(value)}
                    onChange={() => handleNewsCategory(value)}
                  />
                  <span className="category-indicator" style={{ backgroundColor: color }} />
                  <span className="category-label">{label}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="controls-section">
            <h2 className="section-title">Display</h2>
            <div className="slider-control">
              <label className="slider-label">
                <span>Opacity</span>
                <span>{Math.round(config.opacity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={config.opacity}
                onChange={handleOpacityChange}
                className="slider"
              />
            </div>
            <div className="slider-control">
              <label className="slider-label">
                <span>Sensitivity</span>
                <span>{config.sensitivity.toFixed(1)}x</span>
              </label>
              <input
                type="range"
                min="0.5"
                max="3"
                step="0.1"
                value={config.sensitivity}
                onChange={handleSensitivityChange}
                className="slider"
              />
            </div>
          </section>
        </>
      )}

      {/* Predictions Controls */}
      {(mode === 'predictions' || mode === 'combined') && (
        <>
          <section className="controls-section">
            <h2 className="section-title">Probability Range</h2>
            <div className="slider-control">
              <label className="slider-label">
                <span>Min</span>
                <span>{Math.round(predictionFilters.minProbability * 100)}%</span>
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={predictionFilters.minProbability * 100}
                onChange={(e) =>
                  setPredictionFilters({ minProbability: parseInt(e.target.value) / 100 })
                }
                className="slider prediction-slider"
              />
            </div>
          </section>

          <section className="controls-section">
            <h2 className="section-title">Min Volume</h2>
            <select
              value={predictionFilters.minVolume}
              onChange={(e) => setPredictionFilters({ minVolume: parseInt(e.target.value) })}
              className="volume-select"
            >
              <option value="0">Any</option>
              <option value="1000">$1K+</option>
              <option value="10000">$10K+</option>
              <option value="50000">$50K+</option>
              <option value="100000">$100K+</option>
              <option value="500000">$500K+</option>
            </select>
          </section>

          <section className="controls-section">
            <h2 className="section-title">Market Categories</h2>
            <div className="category-chips">
              {PREDICTION_CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  className={`category-chip ${
                    predictionFilters.categories.includes(cat.value) ? 'active' : ''
                  }`}
                  onClick={() => handlePredictionCategory(cat.value)}
                >
                  {cat.label}
                </button>
              ))}
            </div>
          </section>

          <section className="controls-section">
            <label className="closing-soon-toggle">
              <input
                type="checkbox"
                checked={predictionFilters.closingSoon}
                onChange={(e) => setPredictionFilters({ closingSoon: e.target.checked })}
              />
              <span className="toggle-indicator" />
              <span className="toggle-label">Closing Soon (&lt;24h)</span>
            </label>
          </section>

          <section className="controls-section">
            <div className="prediction-stats">
              <span className="stat-value">{predictions.length}</span>
              <span className="stat-label">Markets</span>
            </div>
          </section>
        </>
      )}

      {/* Hot Spots (News mode) */}
      {mode === 'news' && hotSpots.length > 0 && (
        <section className="controls-section">
          <h2 className="section-title">Hot Spots</h2>
          <div className="hotspots-list">
            {hotSpots.slice(0, 5).map((spot, index) => (
              <div key={spot.h3Index} className="hotspot-item">
                <div className="hotspot-rank">{index + 1}</div>
                <div className="hotspot-info">
                  <div className="hotspot-name">{spot.name}</div>
                  <div className="hotspot-meta">
                    <span className="hotspot-count">{spot.eventCount} events</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Color Legend */}
      <section className="controls-section">
        <h2 className="section-title">
          {mode === 'predictions' ? 'Probability' : 'Intensity'}
        </h2>
        <div className="color-legend">
          <div
            className="legend-gradient"
            style={{
              background:
                mode === 'predictions'
                  ? 'linear-gradient(90deg, #6366f1, #14b8a6)'
                  : 'linear-gradient(90deg, rgb(0, 51, 204) 0%, rgb(0, 179, 230) 25%, rgb(255, 230, 0) 50%, rgb(255, 128, 0) 75%, rgb(255, 0, 0) 100%)',
            }}
          />
          <div className="legend-labels">
            <span>{mode === 'predictions' ? '50%' : 'Low'}</span>
            <span>{mode === 'predictions' ? '100%' : 'High'}</span>
          </div>
        </div>
      </section>
    </div>
  );
}
