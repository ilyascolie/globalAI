import { useEffect, useRef, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { HeatmapLayer } from '../Heatmap/HeatmapLayer';
import { PredictionMarkersLayer } from '../Predictions/PredictionMarkersLayer';
import { useHeatmapStore } from '../../stores/useHeatmapStore';
import { usePredictionStore } from '../../stores/usePredictionStore';
import type { ViewMode } from '../../types';

interface GlobeProps {
  className?: string;
  mode: ViewMode;
}

export function Globe({ className, mode }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeRef = useRef<THREE.Mesh | null>(null);
  const heatmapLayerRef = useRef<HeatmapLayer | null>(null);
  const predictionLayerRef = useRef<PredictionMarkersLayer | null>(null);
  const animationFrameRef = useRef<number>(0);

  const { dataTexture, config, pulseEvents, clearExpiredPulses } = useHeatmapStore();
  const { predictions, filters: predictionFilters } = usePredictionStore();

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0f);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, 3);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.rotateSpeed = 0.5;
    controls.minDistance = 1.2;
    controls.maxDistance = 5;
    controls.enablePan = false;
    controlsRef.current = controls;

    // Create globe
    createGlobe(scene);

    // Create atmosphere glow
    createAtmosphere(scene);

    // Create heatmap layer for news
    heatmapLayerRef.current = new HeatmapLayer(scene);

    // Create prediction markers layer
    predictionLayerRef.current = new PredictionMarkersLayer(scene);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // Add directional light (sun)
    const sunLight = new THREE.DirectionalLight(0xffffff, 1.0);
    sunLight.position.set(5, 3, 5);
    scene.add(sunLight);

    // Start animation loop
    animate();
  }, []);

  // Create earth globe
  const createGlobe = (scene: THREE.Scene) => {
    const geometry = new THREE.SphereGeometry(1, 64, 64);
    const earthTexture = createProceduralEarthTexture();

    const material = new THREE.MeshPhongMaterial({
      map: earthTexture,
      bumpScale: 0.02,
      specular: new THREE.Color(0x333333),
      shininess: 5,
    });

    const globe = new THREE.Mesh(geometry, material);
    scene.add(globe);
    globeRef.current = globe;
  };

  // Create procedural earth texture
  const createProceduralEarthTexture = (): THREE.CanvasTexture => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Ocean base color
    ctx.fillStyle = '#1a3a5c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Simple continent shapes
    ctx.fillStyle = '#2d5a3d';

    // North America
    ctx.beginPath();
    ctx.ellipse(350, 280, 200, 150, 0, 0, Math.PI * 2);
    ctx.fill();

    // South America
    ctx.beginPath();
    ctx.ellipse(450, 600, 100, 180, 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Europe
    ctx.beginPath();
    ctx.ellipse(1100, 250, 120, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Africa
    ctx.beginPath();
    ctx.ellipse(1100, 500, 130, 180, 0, 0, Math.PI * 2);
    ctx.fill();

    // Asia
    ctx.beginPath();
    ctx.ellipse(1400, 300, 280, 180, 0, 0, Math.PI * 2);
    ctx.fill();

    // Australia
    ctx.beginPath();
    ctx.ellipse(1700, 650, 100, 80, 0, 0, Math.PI * 2);
    ctx.fill();

    // Add some noise/texture
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const noise = (Math.random() - 0.5) * 20;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise));
    }
    ctx.putImageData(imageData, 0, 0);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    return texture;
  };

  // Create atmosphere glow effect
  const createAtmosphere = (scene: THREE.Scene) => {
    const geometry = new THREE.SphereGeometry(1.05, 64, 64);

    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);
          vec3 color = vec3(0.3, 0.6, 1.0) * fresnel;
          float alpha = fresnel * 0.4;
          gl_FragColor = vec4(color, alpha);
        }
      `,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const atmosphere = new THREE.Mesh(geometry, material);
    scene.add(atmosphere);
  };

  // Animation loop
  const animate = () => {
    animationFrameRef.current = requestAnimationFrame(animate);

    if (controlsRef.current) {
      controlsRef.current.update();
    }

    // Update heatmap layer
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.update(Date.now() / 1000);
    }

    // Update prediction markers
    if (predictionLayerRef.current) {
      predictionLayerRef.current.update(Date.now() / 1000);
    }

    // Clear expired pulses periodically
    clearExpiredPulses();

    // Render
    if (rendererRef.current && sceneRef.current && cameraRef.current) {
      rendererRef.current.render(sceneRef.current, cameraRef.current);
    }
  };

  // Handle resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();

    rendererRef.current.setSize(width, height);
  }, []);

  // Update heatmap data texture
  useEffect(() => {
    if (heatmapLayerRef.current && dataTexture) {
      heatmapLayerRef.current.updateDataTexture(dataTexture);
    }
  }, [dataTexture]);

  // Update heatmap config
  useEffect(() => {
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.updateConfig(config);
    }
  }, [config]);

  // Update pulse events
  useEffect(() => {
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.updatePulses(pulseEvents);
    }
  }, [pulseEvents]);

  // Update prediction markers
  useEffect(() => {
    if (predictionLayerRef.current) {
      predictionLayerRef.current.updatePredictions(predictions, predictionFilters);
    }
  }, [predictions, predictionFilters]);

  // Update visibility based on mode
  useEffect(() => {
    if (heatmapLayerRef.current) {
      heatmapLayerRef.current.setVisible(mode === 'news' || mode === 'combined');
    }
    if (predictionLayerRef.current) {
      predictionLayerRef.current.setVisible(mode === 'predictions' || mode === 'combined');
    }
  }, [mode]);

  // Initialize scene
  useEffect(() => {
    initScene();

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);

      // Cleanup
      if (heatmapLayerRef.current) {
        heatmapLayerRef.current.dispose();
      }
      if (predictionLayerRef.current) {
        predictionLayerRef.current.dispose();
      }
      if (rendererRef.current) {
        rendererRef.current.dispose();
        rendererRef.current.domElement.remove();
      }
    };
  }, [initScene, handleResize]);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: '100%',
        position: 'absolute',
        top: 0,
        left: 0,
      }}
    />
  );
}
