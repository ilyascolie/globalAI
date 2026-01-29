import { useMemo, useRef } from 'react';
import { useFrame, ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import { useStore } from '../../stores/useStore';
import type { Event } from '../../types';

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number = 1.008): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lng + 180) * (Math.PI / 180);

  const x = -radius * Math.sin(phi) * Math.cos(theta);
  const y = radius * Math.cos(phi);
  const z = radius * Math.sin(phi) * Math.sin(theta);

  return new THREE.Vector3(x, y, z);
}

// Get color based on intensity (blue -> yellow -> orange -> red)
function getIntensityColor(intensity: number): THREE.Color {
  const t = intensity / 100;

  if (t < 0.25) {
    // Blue to cyan
    return new THREE.Color().lerpColors(
      new THREE.Color('#1e40af'),
      new THREE.Color('#06b6d4'),
      t * 4
    );
  } else if (t < 0.5) {
    // Cyan to yellow
    return new THREE.Color().lerpColors(
      new THREE.Color('#06b6d4'),
      new THREE.Color('#facc15'),
      (t - 0.25) * 4
    );
  } else if (t < 0.75) {
    // Yellow to orange
    return new THREE.Color().lerpColors(
      new THREE.Color('#facc15'),
      new THREE.Color('#f97316'),
      (t - 0.5) * 4
    );
  } else {
    // Orange to red
    return new THREE.Color().lerpColors(
      new THREE.Color('#f97316'),
      new THREE.Color('#dc2626'),
      (t - 0.75) * 4
    );
  }
}

interface EventMarkerProps {
  event: Event;
  onClick: (event: Event) => void;
}

function EventMarker({ event, onClick }: EventMarkerProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const position = useMemo(
    () => latLngToVector3(event.lat, event.lng),
    [event.lat, event.lng]
  );

  const size = useMemo(() => {
    // Size based on intensity
    const baseSize = 0.01;
    const maxSize = 0.04;
    return baseSize + (event.intensity / 100) * (maxSize - baseSize);
  }, [event.intensity]);

  const color = useMemo(() => getIntensityColor(event.intensity), [event.intensity]);

  // Subtle pulsing for high intensity events
  useFrame(({ clock }) => {
    if (meshRef.current && event.intensity > 70) {
      const pulse = Math.sin(clock.getElapsedTime() * 2) * 0.1 + 0.9;
      meshRef.current.scale.setScalar(pulse);
    }
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    onClick(event);
  };

  return (
    <group position={position}>
      {/* Glow for high intensity */}
      {event.intensity > 60 && (
        <mesh>
          <sphereGeometry args={[size * 2, 16, 16]} />
          <meshBasicMaterial color={color} transparent opacity={0.15} />
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
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={0.4}
          roughness={0.4}
          metalness={0.1}
        />
      </mesh>
    </group>
  );
}

export function NewsHeatmap() {
  const { events, heatmapPoints, setSelectedEvent } = useStore();

  const handleEventClick = (event: Event) => {
    setSelectedEvent(event);
  };

  // Create heatmap intensity mesh from aggregated points
  const heatmapGeometry = useMemo(() => {
    if (heatmapPoints.length === 0) return null;

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const colors: number[] = [];
    const sizes: number[] = [];

    for (const point of heatmapPoints) {
      const pos = latLngToVector3(point.lat, point.lng, 1.003);
      positions.push(pos.x, pos.y, pos.z);

      const color = getIntensityColor(point.intensity);
      colors.push(color.r, color.g, color.b);

      const size = 0.02 + (point.intensity / 100) * 0.04;
      sizes.push(size);
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('size', new THREE.Float32BufferAttribute(sizes, 1));

    return geometry;
  }, [heatmapPoints]);

  return (
    <group>
      {/* Heatmap points layer */}
      {heatmapGeometry && (
        <points geometry={heatmapGeometry}>
          <pointsMaterial
            vertexColors
            size={0.03}
            sizeAttenuation
            transparent
            opacity={0.6}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* Individual event markers */}
      {events.map((event) => (
        <EventMarker key={event.id} event={event} onClick={handleEventClick} />
      ))}
    </group>
  );
}
