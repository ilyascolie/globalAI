import { useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stars } from '@react-three/drei';
import { Globe } from './components/Globe/Globe';
import { Controls } from './components/Controls/Controls';
import { EventPanel } from './components/EventPanel/EventPanel';
import { useStore } from './stores/useStore';
import { fetchEvents, fetchPredictions, fetchHeatmap } from './services/api';
import './App.css';

function App() {
  const { mode, setEvents, setPredictions, setHeatmapPoints, setIsLoading } = useStore();

  // Fetch data on mount and when mode changes
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        if (mode === 'news' || mode === 'combined') {
          const [eventsRes, heatmapRes] = await Promise.all([
            fetchEvents({ limit: 100 }),
            fetchHeatmap({ resolution: 'medium' }),
          ]);
          setEvents(eventsRes.events);
          setHeatmapPoints(heatmapRes.points);
        }

        if (mode === 'predictions' || mode === 'combined') {
          const predictionsRes = await fetchPredictions();
          setPredictions(predictionsRes.predictions);
        }
      } catch (error) {
        console.error('Error loading data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Refresh every 5 minutes
    const interval = setInterval(loadData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [mode, setEvents, setPredictions, setHeatmapPoints, setIsLoading]);

  return (
    <div className="app">
      <div className="canvas-container">
        <Canvas
          camera={{ position: [0, 0, 2.5], fov: 45 }}
          gl={{ antialias: true, alpha: true }}
        >
          <color attach="background" args={['#0a0a0f']} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[5, 3, 5]} intensity={1} />
          <pointLight position={[-10, -10, -10]} intensity={0.3} color="#4a9eff" />
          <Stars radius={100} depth={50} count={5000} factor={4} fade speed={1} />
          <Globe />
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            minDistance={1.2}
            maxDistance={4}
            rotateSpeed={0.5}
            zoomSpeed={0.8}
            dampingFactor={0.05}
            enableDamping
          />
        </Canvas>
      </div>

      <Controls />
      <EventPanel />

      <header className="app-header glass-card">
        <h1>Global Events</h1>
        <span className="tagline">Real-time news & predictions</span>
      </header>
    </div>
  );
}

export default App;
