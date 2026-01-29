import { useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../stores/useStore';
import type { Prediction, PredictionLocation } from '../../types';

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number = 1.01): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

// Get marker size based on volume (log scale)
function getMarkerSize(volume: number): number {
  const minSize = 0.015;
  const maxSize = 0.06;
  // Log scale for volume (typically ranges from 1000 to 10M+)
  const logVolume = Math.log10(Math.max(volume, 1000));
  const normalizedVolume = Math.min(1, (logVolume - 3) / 4); // 1000 to 10M
  return minSize + normalizedVolume * (maxSize - minSize);
}

// Get color based on probability
function getProbabilityColor(probability: number): THREE.Color {
  // Purple to teal gradient based on probability
  // Low prob (near 0.5) = muted purple
  // High prob (near 0 or 1) = bright teal/purple
  const distance = Math.abs(probability - 0.5) * 2; // 0 to 1

  if (probability > 0.5) {
    // Leaning yes - use teal
    return new THREE.Color().lerpColors(
      new THREE.Color('#6366f1'), // muted purple
      new THREE.Color('#14b8a6'), // bright teal
      distance
    );
  } else {
    // Leaning no - use purple
    return new THREE.Color().lerpColors(
      new THREE.Color('#6366f1'), // muted purple
      new THREE.Color('#a855f7'), // bright purple
      distance
    );
  }
}

interface MarkerProps {
  prediction: Prediction;
  location: PredictionLocation;
  onClick: (prediction: Prediction) => void;
}

function PredictionMarker({ prediction, location, onClick }: MarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const position = useMemo(
    () => latLngToVector3(location.lat, location.lng),
    [location.lat, location.lng]
  );

  const size = useMemo(() => getMarkerSize(prediction.volume), [prediction.volume]);
  const color = useMemo(
    () => getProbabilityColor(prediction.probability),
    [prediction.probability]
  );

  // Animate markers closing soon
  useFrame(({ clock }) => {
    if (meshRef.current && prediction.closingSoon) {
      // Pulsing effect for closing soon markets
      const pulse = Math.sin(clock.getElapsedTime() * 4) * 0.3 + 0.7;
      meshRef.current.scale.setScalar(pulse);
    }
    if (glowRef.current && prediction.closingSoon) {
      // Glow animation
      const glow = Math.sin(clock.getElapsedTime() * 3) * 0.15 + 0.25;
      (glowRef.current.material as THREE.MeshBasicMaterial).opacity = glow;
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(prediction);
  };

  return (
    <group position={position}>
      {/* Glow effect for closing soon */}
      {prediction.closingSoon && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[size * 2.5, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )}

      {/* Main marker */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'default';
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={prediction.closingSoon ? 0.8 : 0.5}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

      {/* Ring indicator for high volume markets */}
      {prediction.volume > 100000 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[size * 1.3, size * 1.5, 32]} />
          <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Confidence indicator - opacity based on location confidence */}
      <mesh>
        <sphereGeometry args={[size * 0.3, 8, 8]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={location.confidence * 0.8}
        />
      </mesh>
    </group>
  );
}

export function PredictionMarkers() {
  const { predictions, filters, setSelectedPrediction } = useStore();

  // Filter predictions based on current filters
  const filteredPredictions = useMemo(() => {
    return predictions.filter((p) => {
      if (p.probability < filters.minProbability) return false;
      if (p.probability > filters.maxProbability) return false;
      if (p.volume < filters.minVolume) return false;
      if (filters.closingSoon && !p.closingSoon) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(p.category)) {
        return false;
      }
      return true;
    });
  }, [predictions, filters]);

  const handleMarkerClick = (prediction: Prediction) => {
    setSelectedPrediction(prediction);
  };

  return (
    <group>
      {filteredPredictions.map((prediction) =>
        prediction.locations.map((location, idx) => (
          <PredictionMarker
            key={`${prediction.marketId}-${idx}`}
            prediction={prediction}
            location={location}
            onClick={handleMarkerClick}
          />
        ))
      )}
    </group>
  );
}
