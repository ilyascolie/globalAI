import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { useStore } from '../../stores/useStore';
import { PredictionMarkers } from '../Predictions/PredictionMarkers';
import { NewsHeatmap } from '../Heatmap/NewsHeatmap';

export function Globe() {
  const globeRef = useRef<THREE.Mesh>(null);
  const { mode } = useStore();

  // Earth textures - using placeholder colors for now
  // In production, use NASA Blue Marble textures
  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Create gradient for ocean/land
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#0a1628');
    gradient.addColorStop(0.3, '#0d1f35');
    gradient.addColorStop(0.5, '#0a1628');
    gradient.addColorStop(0.7, '#0d1f35');
    gradient.addColorStop(1, '#0a1628');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add some "continent" shapes
    ctx.fillStyle = '#1a2d45';
    // North America
    ctx.beginPath();
    ctx.ellipse(400, 300, 200, 150, 0, 0, Math.PI * 2);
    ctx.fill();
    // Europe/Africa
    ctx.beginPath();
    ctx.ellipse(1100, 400, 150, 250, 0.2, 0, Math.PI * 2);
    ctx.fill();
    // Asia
    ctx.beginPath();
    ctx.ellipse(1500, 350, 250, 180, -0.1, 0, Math.PI * 2);
    ctx.fill();
    // South America
    ctx.beginPath();
    ctx.ellipse(600, 650, 100, 180, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Australia
    ctx.beginPath();
    ctx.ellipse(1700, 680, 100, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    return texture;
  }, []);

  // Slow rotation
  useFrame(({ clock }) => {
    if (globeRef.current) {
      globeRef.current.rotation.y = clock.getElapsedTime() * 0.02;
    }
  });

  return (
    <group>
      {/* Main globe */}
      <Sphere ref={globeRef} args={[1, 64, 64]}>
        <meshStandardMaterial
          map={earthTexture}
          roughness={0.8}
          metalness={0.1}
          emissive={new THREE.Color('#0a1628')}
          emissiveIntensity={0.1}
        />
      </Sphere>

      {/* Atmosphere glow */}
      <Sphere args={[1.02, 64, 64]}>
        <meshBasicMaterial
          color="#4a9eff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* Outer atmosphere */}
      <Sphere args={[1.05, 32, 32]}>
        <meshBasicMaterial
          color="#4a9eff"
          transparent
          opacity={0.03}
          side={THREE.BackSide}
        />
      </Sphere>

      {/* News heatmap layer */}
      {(mode === 'news' || mode === 'combined') && <NewsHeatmap />}

      {/* Prediction markers */}
      {(mode === 'predictions' || mode === 'combined') && <PredictionMarkers />}
    </group>
  );
}
