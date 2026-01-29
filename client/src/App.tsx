import { useEffect } from 'react';
import { Globe } from './components/Globe';
import { Controls } from './components/Controls';
import { useHeatmapProcessor, useSampleData } from './hooks/useHeatmapProcessor';
import { useHeatmapStore } from './stores/useHeatmapStore';
import './App.css';

function App() {
  // Process heatmap data when events/filters change
  useHeatmapProcessor();

  // Sample data generator
  const { generateSampleEvents } = useSampleData();
  const { isLoading, events } = useHeatmapStore();

  // Load sample data on mount
  useEffect(() => {
    generateSampleEvents();
  }, [generateSampleEvents]);

  return (
    <div className="app">
      {/* Three.js Globe */}
      <Globe className="globe-container" />

      {/* UI Controls */}
      <Controls />

      {/* Loading indicator */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <p>Loading events...</p>
        </div>
      )}

      {/* Event count badge */}
      <div className="event-count">
        <span className="count">{events.length}</span>
        <span className="label">Events</span>
      </div>

      {/* Attribution */}
      <div className="attribution">
        Global Events Heatmap | Three.js + H3
      </div>
    </div>
  );
}

export default App;
