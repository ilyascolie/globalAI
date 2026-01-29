import { useEffect, useState } from 'react';
import { Globe } from './components/Globe';
import { Controls } from './components/Controls';
import { EventPanel } from './components/EventPanel';
import { PredictionPanel } from './components/Predictions/PredictionPanel';
import { useHeatmapProcessor, useSampleData } from './hooks/useHeatmapProcessor';
import { useHeatmapStore } from './stores/useHeatmapStore';
import { usePredictionStore } from './stores/usePredictionStore';
import { fetchPredictions } from './services/api';
import type { ViewMode } from './types';
import './App.css';

function App() {
  const [mode, setMode] = useState<ViewMode>('combined');

  // Process heatmap data when events/filters change
  useHeatmapProcessor();

  // Sample data generator for news
  const { generateSampleEvents } = useSampleData();
  const { isLoading: isLoadingNews, events } = useHeatmapStore();
  const {
    predictions,
    selectedPrediction,
    isLoading: isLoadingPredictions,
    setPredictions,
    setIsLoading: setIsPredictionsLoading
  } = usePredictionStore();

  // Load sample news data on mount
  useEffect(() => {
    generateSampleEvents();
  }, [generateSampleEvents]);

  // Load predictions data
  useEffect(() => {
    const loadPredictions = async () => {
      if (mode === 'predictions' || mode === 'combined') {
        setIsPredictionsLoading(true);
        try {
          const response = await fetchPredictions();
          setPredictions(response.predictions);
        } catch (error) {
          console.error('Error loading predictions:', error);
        } finally {
          setIsPredictionsLoading(false);
        }
      }
    };

    loadPredictions();

    // Refresh predictions every 5 minutes
    const interval = setInterval(loadPredictions, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mode, setPredictions, setIsPredictionsLoading]);

  const isLoading = isLoadingNews || isLoadingPredictions;

  return (
    <div className="app">
      {/* Three.js Globe */}
      <Globe className="globe-container" mode={mode} />

      {/* UI Controls with mode toggle */}
      <Controls mode={mode} onModeChange={setMode} />

      {/* Event Panel for News */}
      <EventPanel />

      {/* Prediction Panel for Polymarket */}
      {selectedPrediction && <PredictionPanel />}

      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading {mode === 'predictions' ? 'predictions' : 'events'}...</p>
        </div>
      )}

      {/* Stats badges */}
      <div className="stats-container">
        {(mode === 'news' || mode === 'combined') && (
          <div className="event-count">
            <span className="count">{events.length}</span>
            <span className="label">Events</span>
          </div>
        )}
        {(mode === 'predictions' || mode === 'combined') && (
          <div className="prediction-count">
            <span className="count">{predictions.length}</span>
            <span className="label">Markets</span>
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="attribution">
        Global Events & Predictions | Three.js + Polymarket
      </div>
    </div>
  );
}

export default App;
