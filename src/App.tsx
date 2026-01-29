import { useState, useCallback } from 'react';
import Globe from './components/Globe';
import InfoPanel from './components/InfoPanel';
import type { LatLong } from './utils/coordinates';
import './App.css';

function App() {
  const [selectedLocation, setSelectedLocation] = useState<LatLong | null>(null);

  const handleLocationSelect = useCallback((location: LatLong) => {
    setSelectedLocation(location);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedLocation(null);
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <h1>Global Explorer</h1>
        <p>Interactive 3D Earth Visualization</p>
      </header>

      <main className="app-main">
        <Globe
          onLocationSelect={handleLocationSelect}
        />
      </main>

      <InfoPanel
        location={selectedLocation}
        onClose={handleClosePanel}
      />
    </div>
  );
}

export default App;
