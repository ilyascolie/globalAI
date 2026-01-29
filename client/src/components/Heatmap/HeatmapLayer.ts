import * as THREE from 'three';
import {
  heatmapVertexShader,
  heatmapFragmentShader,
  DEFAULT_COLOR_RAMP,
  DEFAULT_COLOR_POSITIONS,
} from '../../shaders';
import type { HeatmapConfig } from '../../types';

interface PulseEvent {
  lat: number;
  lng: number;
  intensity: number;
  startTime: number;
}

/**
 * Shader-based heatmap layer for the globe
 * Uses a data texture for efficient GPU-based rendering
 */
export class HeatmapLayer {
  private scene: THREE.Scene;
  private mesh: THREE.Mesh | null = null;
  private material: THREE.ShaderMaterial | null = null;
  private dataTexture: THREE.DataTexture | null = null;

  // Texture dimensions (1 degree resolution)
  private readonly textureWidth = 360;
  private readonly textureHeight = 180;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.init();
  }

  private init(): void {
    // Create sphere geometry slightly larger than globe
    const geometry = new THREE.SphereGeometry(1.003, 128, 64);

    // Initialize data texture with zeros
    const data = new Float32Array(this.textureWidth * this.textureHeight);
    this.dataTexture = new THREE.DataTexture(
      data,
      this.textureWidth,
      this.textureHeight,
      THREE.RedFormat,
      THREE.FloatType
    );
    this.dataTexture.needsUpdate = true;
    this.dataTexture.minFilter = THREE.LinearFilter;
    this.dataTexture.magFilter = THREE.LinearFilter;
    this.dataTexture.wrapS = THREE.RepeatWrapping;
    this.dataTexture.wrapT = THREE.ClampToEdgeWrapping;

    // Create color ramp uniforms
    const colorRamp = new Float32Array(15); // 5 colors * 3 components
    const colorPositions = new Float32Array(5);

    for (let i = 0; i < 5; i++) {
      colorRamp[i * 3] = DEFAULT_COLOR_RAMP[i][0];
      colorRamp[i * 3 + 1] = DEFAULT_COLOR_RAMP[i][1];
      colorRamp[i * 3 + 2] = DEFAULT_COLOR_RAMP[i][2];
      colorPositions[i] = DEFAULT_COLOR_POSITIONS[i];
    }

    // Initialize pulse arrays
    const pulsePositions = new Float32Array(30); // 10 pulses * 3 components (lat, lng, startTime)
    const pulseIntensities = new Float32Array(10);

    // Create shader material
    this.material = new THREE.ShaderMaterial({
      vertexShader: heatmapVertexShader,
      fragmentShader: heatmapFragmentShader,
      uniforms: {
        uDataTexture: { value: this.dataTexture },
        uColorRamp: { value: this.createColorRampArray() },
        uColorPositions: { value: colorPositions },
        uOpacity: { value: 0.7 },
        uTime: { value: 0 },
        uPulsePositions: { value: pulsePositions },
        uPulseIntensities: { value: pulseIntensities },
        uPulseCount: { value: 0 },
        uIntensityMultiplier: { value: 1.0 },
      },
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.FrontSide,
    });

    // Create mesh
    this.mesh = new THREE.Mesh(geometry, this.material);
    this.scene.add(this.mesh);
  }

  private createColorRampArray(): THREE.Vector3[] {
    return DEFAULT_COLOR_RAMP.map(
      (color) => new THREE.Vector3(color[0], color[1], color[2])
    );
  }

  /**
   * Update the data texture with new intensity values
   */
  updateDataTexture(data: Float32Array): void {
    if (!this.dataTexture) return;

    // Ensure data is the correct size
    if (data.length !== this.textureWidth * this.textureHeight) {
      console.error('Data texture size mismatch');
      return;
    }

    // Update texture data
    this.dataTexture.image.data.set(data);
    this.dataTexture.needsUpdate = true;
  }

  /**
   * Update heatmap configuration
   */
  updateConfig(config: HeatmapConfig): void {
    if (!this.material) return;

    this.material.uniforms.uOpacity.value = config.opacity;
    this.material.uniforms.uIntensityMultiplier.value = config.sensitivity;

    // Update color ramp if changed
    if (config.colorGradient && config.colorGradient.length === 5) {
      const colorRamp = config.colorGradient.map(
        (stop) => new THREE.Vector3(stop.color[0], stop.color[1], stop.color[2])
      );
      this.material.uniforms.uColorRamp.value = colorRamp;

      const positions = new Float32Array(
        config.colorGradient.map((stop) => stop.position)
      );
      this.material.uniforms.uColorPositions.value = positions;
    }
  }

  /**
   * Update pulse effect positions for new events
   */
  updatePulses(pulses: PulseEvent[]): void {
    if (!this.material) return;

    const positions = this.material.uniforms.uPulsePositions.value as Float32Array;
    const intensities = this.material.uniforms.uPulseIntensities.value as Float32Array;

    // Clear arrays
    positions.fill(0);
    intensities.fill(0);

    // Fill with active pulses (max 10)
    const activePulses = pulses.slice(0, 10);
    for (let i = 0; i < activePulses.length; i++) {
      const pulse = activePulses[i];
      positions[i * 3] = pulse.lat;
      positions[i * 3 + 1] = pulse.lng;
      positions[i * 3 + 2] = pulse.startTime;
      intensities[i] = pulse.intensity;
    }

    this.material.uniforms.uPulseCount.value = activePulses.length;
  }

  /**
   * Update time uniform for animations
   */
  update(time: number): void {
    if (!this.material) return;
    this.material.uniforms.uTime.value = time;
  }

  /**
   * Set visibility of the heatmap layer
   */
  setVisible(visible: boolean): void {
    if (this.mesh) {
      this.mesh.visible = visible;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
    }
    if (this.material) {
      this.material.dispose();
    }
    if (this.dataTexture) {
      this.dataTexture.dispose();
    }
  }
}
