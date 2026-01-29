import { useCallback } from 'react';
import { useHeatmapStore } from '../../stores/useHeatmapStore';
import type { EventCategory, TimeRange } from '../../types';
import './Controls.css';

const TIME_RANGES: { value: TimeRange; label: string }[] = [
  { value: '1h', label: '1 Hour' },
  { value: '6h', label: '6 Hours' },
  { value: '24h', label: '24 Hours' },
  { value: '7d', label: '7 Days' },
];

const CATEGORIES: { value: EventCategory; label: string; color: string }[] = [
  { value: 'conflict', label: 'Conflict', color: '#ef4444' },
  { value: 'politics', label: 'Politics', color: '#8b5cf6' },
  { value: 'disaster', label: 'Disaster', color: '#f97316' },
  { value: 'economics', label: 'Economics', color: '#22c55e' },
  { value: 'health', label: 'Health', color: '#06b6d4' },
  { value: 'technology', label: 'Technology', color: '#3b82f6' },
  { value: 'environment', label: 'Environment', color: '#84cc16' },
];

export function Controls() {
  const {
    filters,
    setTimeRange,
    toggleCategory,
    config,
    setOpacity,
    setSensitivity,
    hotSpots,
    timeLapse,
    setTimeLapsePlaying,
    setTimeLapseSpeed,
  } = useHeatmapStore();

  const handleTimeRangeChange = useCallback(
    (range: TimeRange) => {
      setTimeRange(range);
    },
    [setTimeRange]
  );

  const handleCategoryToggle = useCallback(
    (category: EventCategory) => {
      toggleCategory(category);
    },
    [toggleCategory]
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

  const handleTimeLapseToggle = useCallback(() => {
    setTimeLapsePlaying(!timeLapse.isPlaying);
  }, [timeLapse.isPlaying, setTimeLapsePlaying]);

  const handleSpeedChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTimeLapseSpeed(parseFloat(e.target.value));
    },
    [setTimeLapseSpeed]
  );

  return (
    <div className="controls">
      {/* Header */}
      <div className="controls-header">
        <h1 className="controls-title">Global Events</h1>
        <p className="controls-subtitle">Real-time Heatmap</p>
      </div>

      {/* Time Range Selection */}
      <section className="controls-section">
        <h2 className="section-title">Time Range</h2>
        <div className="time-range-buttons">
          {TIME_RANGES.map(({ value, label }) => (
            <button
              key={value}
              className={`time-range-btn ${
                filters.timeRange === value ? 'active' : ''
              }`}
              onClick={() => handleTimeRangeChange(value)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* Category Filters */}
      <section className="controls-section">
        <h2 className="section-title">Categories</h2>
        <div className="category-toggles">
          {CATEGORIES.map(({ value, label, color }) => (
            <label key={value} className="category-toggle">
              <input
                type="checkbox"
                checked={filters.categories.has(value)}
                onChange={() => handleCategoryToggle(value)}
              />
              <span
                className="category-indicator"
                style={{ backgroundColor: color }}
              />
              <span className="category-label">{label}</span>
            </label>
          ))}
        </div>
      </section>

      {/* Intensity Controls */}
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

      {/* Time-Lapse Controls */}
      <section className="controls-section">
        <h2 className="section-title">Time-Lapse</h2>
        <div className="timelapse-controls">
          <button
            className={`timelapse-btn ${timeLapse.isPlaying ? 'playing' : ''}`}
            onClick={handleTimeLapseToggle}
          >
            {timeLapse.isPlaying ? 'Pause' : 'Play'}
          </button>
          <div className="slider-control">
            <label className="slider-label">
              <span>Speed</span>
              <span>{timeLapse.speed}x</span>
            </label>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={timeLapse.speed}
              onChange={handleSpeedChange}
              className="slider"
              disabled={timeLapse.isPlaying}
            />
          </div>
        </div>
      </section>

      {/* Hot Spots */}
      <section className="controls-section">
        <h2 className="section-title">Hot Spots</h2>
        <div className="hotspots-list">
          {hotSpots.length === 0 ? (
            <p className="no-hotspots">No active hot spots</p>
          ) : (
            hotSpots.map((spot, index) => (
              <div key={spot.h3Index} className="hotspot-item">
                <div className="hotspot-rank">{index + 1}</div>
                <div className="hotspot-info">
                  <div className="hotspot-name">{spot.name}</div>
                  <div className="hotspot-meta">
                    <span className="hotspot-count">
                      {spot.eventCount} events
                    </span>
                    <span
                      className="hotspot-category"
                      style={{
                        color:
                          CATEGORIES.find((c) => c.value === spot.dominantCategory)
                            ?.color || '#888',
                      }}
                    >
                      {spot.dominantCategory}
                    </span>
                  </div>
                </div>
                <div
                  className="hotspot-intensity"
                  style={{
                    background: `linear-gradient(90deg,
                      rgba(0, 80, 200, 0.8) 0%,
                      rgba(255, 200, 0, 0.8) ${spot.totalIntensity}%,
                      transparent ${spot.totalIntensity}%
                    )`,
                  }}
                />
              </div>
            ))
          )}
        </div>
      </section>

      {/* Color Legend */}
      <section className="controls-section">
        <h2 className="section-title">Intensity</h2>
        <div className="color-legend">
          <div className="legend-gradient" />
          <div className="legend-labels">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </section>
    </div>
  );
}
