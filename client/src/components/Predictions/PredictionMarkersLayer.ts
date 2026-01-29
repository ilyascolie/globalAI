import * as THREE from 'three';
import type { Prediction, PredictionCategory } from '../../types';
import type { PredictionFilters } from '../../stores/usePredictionStore';

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number = 1.02): THREE.Vector3 {
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
  const logVolume = Math.log10(Math.max(volume, 1000));
  const normalizedVolume = Math.min(1, (logVolume - 3) / 4);
  return minSize + normalizedVolume * (maxSize - minSize);
}

// Get color based on probability - purple/teal gradient
function getProbabilityColor(probability: number): THREE.Color {
  const distance = Math.abs(probability - 0.5) * 2;

  if (probability > 0.5) {
    return new THREE.Color().lerpColors(
      new THREE.Color('#6366f1'),
      new THREE.Color('#14b8a6'),
      distance
    );
  } else {
    return new THREE.Color().lerpColors(
      new THREE.Color('#6366f1'),
      new THREE.Color('#a855f7'),
      distance
    );
  }
}

interface MarkerData {
  mesh: THREE.Mesh;
  glowMesh?: THREE.Mesh;
  prediction: Prediction;
  baseScale: number;
  closingSoon: boolean;
}

export class PredictionMarkersLayer {
  private scene: THREE.Scene;
  private group: THREE.Group;
  private markers: MarkerData[] = [];
  private visible: boolean = true;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.group.name = 'predictionMarkers';
    scene.add(this.group);
  }

  updatePredictions(predictions: Prediction[], filters: PredictionFilters): void {
    // Clear existing markers
    this.clearMarkers();

    // Filter predictions
    const filtered = predictions.filter((p) => {
      if (p.probability < filters.minProbability) return false;
      if (p.probability > filters.maxProbability) return false;
      if (p.volume < filters.minVolume) return false;
      if (filters.closingSoon && !p.closingSoon) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(p.category)) {
        return false;
      }
      return true;
    });

    // Create markers for each prediction
    for (const prediction of filtered) {
      for (const location of prediction.locations) {
        this.createMarker(prediction, location.lat, location.lng, location.confidence);
      }
    }
  }

  private createMarker(
    prediction: Prediction,
    lat: number,
    lng: number,
    confidence: number
  ): void {
    const position = latLngToVector3(lat, lng);
    const size = getMarkerSize(prediction.volume);
    const color = getProbabilityColor(prediction.probability);

    // Main marker sphere
    const geometry = new THREE.SphereGeometry(size, 16, 16);
    const material = new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: prediction.closingSoon ? 0.8 : 0.5,
      roughness: 0.3,
      metalness: 0.2,
      transparent: true,
      opacity: 0.7 + confidence * 0.3,
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    this.group.add(mesh);

    let glowMesh: THREE.Mesh | undefined;

    // Add glow for closing soon markets
    if (prediction.closingSoon) {
      const glowGeometry = new THREE.SphereGeometry(size * 2.5, 16, 16);
      const glowMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.2,
      });
      glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
      glowMesh.position.copy(position);
      this.group.add(glowMesh);
    }

    // Add ring for high volume markets
    if (prediction.volume > 100000) {
      const ringGeometry = new THREE.RingGeometry(size * 1.3, size * 1.5, 32);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.5,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeometry, ringMaterial);
      ring.position.copy(position);
      ring.lookAt(new THREE.Vector3(0, 0, 0));
      this.group.add(ring);
    }

    this.markers.push({
      mesh,
      glowMesh,
      prediction,
      baseScale: 1,
      closingSoon: prediction.closingSoon,
    });
  }

  private clearMarkers(): void {
    for (const marker of this.markers) {
      this.group.remove(marker.mesh);
      marker.mesh.geometry.dispose();
      (marker.mesh.material as THREE.Material).dispose();

      if (marker.glowMesh) {
        this.group.remove(marker.glowMesh);
        marker.glowMesh.geometry.dispose();
        (marker.glowMesh.material as THREE.Material).dispose();
      }
    }
    this.markers = [];

    // Also remove any ring meshes
    while (this.group.children.length > 0) {
      const child = this.group.children[0];
      this.group.remove(child);
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        (child.material as THREE.Material).dispose();
      }
    }
  }

  update(time: number): void {
    if (!this.visible) return;

    // Animate closing soon markers
    for (const marker of this.markers) {
      if (marker.closingSoon) {
        const pulse = Math.sin(time * 4) * 0.3 + 0.7;
        marker.mesh.scale.setScalar(pulse);

        if (marker.glowMesh) {
          const glowOpacity = Math.sin(time * 3) * 0.15 + 0.25;
          (marker.glowMesh.material as THREE.MeshBasicMaterial).opacity = glowOpacity;
        }
      }
    }
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.group.visible = visible;
  }

  dispose(): void {
    this.clearMarkers();
    this.scene.remove(this.group);
  }
}
