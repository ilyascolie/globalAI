import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { loadEarthTextures, createPlaceholderTexture } from '../../utils/textureLoader';
import {
  vector3ToLatLong,
  getSunDirection,
  latLongToVector3,
  formatCoordinates,
} from '../../utils/coordinates';
import type { LatLong } from '../../utils/coordinates';

// Shader imports (as strings since Vite handles these)
import earthVertexShader from '../../shaders/earthVertex.glsl?raw';
import earthFragmentShader from '../../shaders/earthFragment.glsl?raw';
import atmosphereVertexShader from '../../shaders/atmosphereVertex.glsl?raw';
import atmosphereFragmentShader from '../../shaders/atmosphereFragment.glsl?raw';

import './Globe.css';

interface GlobeProps {
  onLocationSelect?: (location: LatLong) => void;
  onHover?: (location: LatLong | null) => void;
}

interface GlobeState {
  isLoading: boolean;
  loadingProgress: number;
  error: string | null;
  hoveredLocation: LatLong | null;
}

const GLOBE_RADIUS = 5;
const CAMERA_DISTANCE = 15;
const ANIMATION_DURATION = 1500; // ms

export function Globe({ onLocationSelect, onHover }: GlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const earthRef = useRef<THREE.Mesh | null>(null);
  const atmosphereRef = useRef<THREE.Mesh | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const earthMaterialRef = useRef<THREE.ShaderMaterial | null>(null);
  const atmosphereMaterialRef = useRef<THREE.ShaderMaterial | null>(null);

  // Camera animation state
  const cameraAnimationRef = useRef<{
    isAnimating: boolean;
    startPosition: THREE.Vector3;
    targetPosition: THREE.Vector3;
    startTime: number;
    startTarget: THREE.Vector3;
    endTarget: THREE.Vector3;
  } | null>(null);

  // Raycaster for interaction
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  const [state, setState] = useState<GlobeState>({
    isLoading: true,
    loadingProgress: 0,
    error: null,
    hoveredLocation: null,
  });

  // Initialize Three.js scene
  const initScene = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000011);
    sceneRef.current = scene;

    // Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, 0, CAMERA_DISTANCE);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = GLOBE_RADIUS + 2;
    controls.maxDistance = 50;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 1.0;
    controls.panSpeed = 0.8;
    controls.enablePan = true;
    // Limit vertical rotation to prevent flipping
    controls.minPolarAngle = 0.1;
    controls.maxPolarAngle = Math.PI - 0.1;
    controlsRef.current = controls;

    // Add stars background
    createStarfield(scene);

    // Create earth with placeholder texture initially
    createEarth(scene);

    // Create atmosphere
    createAtmosphere(scene);

    // Add ambient light
    const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
    scene.add(ambientLight);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      controls.dispose();
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // Create starfield background
  const createStarfield = useCallback((scene: THREE.Scene) => {
    const starGeometry = new THREE.BufferGeometry();
    const starCount = 10000;
    const positions = new Float32Array(starCount * 3);

    for (let i = 0; i < starCount * 3; i += 3) {
      const radius = 100 + Math.random() * 400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i] = radius * Math.sin(phi) * Math.cos(theta);
      positions[i + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[i + 2] = radius * Math.cos(phi);
    }

    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const starMaterial = new THREE.PointsMaterial({
      color: 0xffffff,
      size: 0.5,
      sizeAttenuation: true,
    });

    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);
  }, []);

  // Create earth sphere
  const createEarth = useCallback((scene: THREE.Scene) => {
    const geometry = new THREE.SphereGeometry(GLOBE_RADIUS, 64, 64);

    // Create shader material with placeholder textures
    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture: { value: createPlaceholderTexture(0x1a4b7a) },
        nightTexture: { value: createPlaceholderTexture(0x0a0a15) },
        sunDirection: { value: getSunDirection() },
      },
      vertexShader: earthVertexShader,
      fragmentShader: earthFragmentShader,
    });

    earthMaterialRef.current = material;

    const earth = new THREE.Mesh(geometry, material);
    scene.add(earth);
    earthRef.current = earth;

    // Load actual textures
    loadEarthTextures({
      onProgress: (loaded, total) => {
        setState((prev) => ({
          ...prev,
          loadingProgress: (loaded / total) * 100,
        }));
      },
      onComplete: () => {
        setState((prev) => ({ ...prev, isLoading: false }));
      },
      onError: (error) => {
        setState((prev) => ({
          ...prev,
          error: error.message,
          isLoading: false,
        }));
      },
    }).then(({ dayTexture, nightTexture }) => {
      if (material) {
        material.uniforms.dayTexture.value = dayTexture;
        material.uniforms.nightTexture.value = nightTexture;
        material.needsUpdate = true;
      }
    });
  }, []);

  // Create atmosphere glow
  const createAtmosphere = useCallback((scene: THREE.Scene) => {
    const geometry = new THREE.SphereGeometry(GLOBE_RADIUS * 1.015, 64, 64);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: getSunDirection() },
      },
      vertexShader: atmosphereVertexShader,
      fragmentShader: atmosphereFragmentShader,
      transparent: true,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    atmosphereMaterialRef.current = material;

    const atmosphere = new THREE.Mesh(geometry, material);
    scene.add(atmosphere);
    atmosphereRef.current = atmosphere;
  }, []);

  // Animation loop
  const animate = useCallback(() => {
    animationFrameRef.current = requestAnimationFrame(animate);

    if (!sceneRef.current || !cameraRef.current || !rendererRef.current || !controlsRef.current) {
      return;
    }

    // Update sun direction based on real time
    const sunDirection = getSunDirection();
    if (earthMaterialRef.current) {
      earthMaterialRef.current.uniforms.sunDirection.value = sunDirection;
    }
    if (atmosphereMaterialRef.current) {
      atmosphereMaterialRef.current.uniforms.sunDirection.value = sunDirection;
    }

    // Handle camera animation
    if (cameraAnimationRef.current?.isAnimating) {
      const { startPosition, targetPosition, startTime, startTarget, endTarget } =
        cameraAnimationRef.current;
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / ANIMATION_DURATION, 1);

      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);

      // Interpolate camera position
      cameraRef.current.position.lerpVectors(startPosition, targetPosition, eased);

      // Interpolate controls target
      controlsRef.current.target.lerpVectors(startTarget, endTarget, eased);

      if (progress >= 1) {
        cameraAnimationRef.current.isAnimating = false;
      }
    }

    controlsRef.current.update();
    rendererRef.current.render(sceneRef.current, cameraRef.current);
  }, []);

  // Handle mouse move for hover detection
  const handleMouseMove = useCallback(
    (event: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

      // Raycast to detect hover
      if (cameraRef.current && earthRef.current) {
        raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
        const intersects = raycasterRef.current.intersectObject(earthRef.current);

        if (intersects.length > 0) {
          const point = intersects[0].point;
          const latLong = vector3ToLatLong(point);

          setState((prev) => ({ ...prev, hoveredLocation: latLong }));
          onHover?.(latLong);

          if (containerRef.current) {
            containerRef.current.style.cursor = 'pointer';
          }
        } else {
          setState((prev) => ({ ...prev, hoveredLocation: null }));
          onHover?.(null);

          if (containerRef.current) {
            containerRef.current.style.cursor = 'grab';
          }
        }
      }
    },
    [onHover]
  );

  // Handle click on globe
  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!containerRef.current || !cameraRef.current || !earthRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      raycasterRef.current.setFromCamera(mouse, cameraRef.current);
      const intersects = raycasterRef.current.intersectObject(earthRef.current);

      if (intersects.length > 0) {
        const point = intersects[0].point;
        const latLong = vector3ToLatLong(point);

        onLocationSelect?.(latLong);

        // Animate camera to look at the clicked location
        animateToLocation(latLong.lat, latLong.lng);
      }
    },
    [onLocationSelect]
  );

  // Animate camera to a specific location
  const animateToLocation = useCallback((lat: number, lng: number) => {
    if (!cameraRef.current || !controlsRef.current) return;

    const targetOnGlobe = latLongToVector3(lat, lng, GLOBE_RADIUS);

    // Calculate camera position - maintain current distance but look at new location
    const currentDistance = cameraRef.current.position.length();
    const cameraOffset = targetOnGlobe.clone().normalize().multiplyScalar(currentDistance);

    cameraAnimationRef.current = {
      isAnimating: true,
      startPosition: cameraRef.current.position.clone(),
      targetPosition: cameraOffset,
      startTime: Date.now(),
      startTarget: controlsRef.current.target.clone(),
      endTarget: new THREE.Vector3(0, 0, 0),
    };
  }, []);

  // Handle window resize
  const handleResize = useCallback(() => {
    if (!containerRef.current || !cameraRef.current || !rendererRef.current) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    cameraRef.current.aspect = width / height;
    cameraRef.current.updateProjectionMatrix();
    rendererRef.current.setSize(width, height);
  }, []);

  // Initialize and cleanup
  useEffect(() => {
    const cleanup = initScene();
    animate();

    window.addEventListener('resize', handleResize);

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleMouseMove);
      container.addEventListener('click', handleClick);
    }

    return () => {
      cleanup?.();
      window.removeEventListener('resize', handleResize);
      if (container) {
        container.removeEventListener('mousemove', handleMouseMove);
        container.removeEventListener('click', handleClick);
      }
    };
  }, [initScene, animate, handleResize, handleMouseMove, handleClick]);

  return (
    <div className="globe-container" ref={containerRef}>
      {state.isLoading && (
        <div className="globe-loading">
          <div className="loading-spinner" />
          <p>Loading Earth textures... {state.loadingProgress.toFixed(0)}%</p>
        </div>
      )}

      {state.error && (
        <div className="globe-error">
          <p>Error: {state.error}</p>
        </div>
      )}

      {state.hoveredLocation && (
        <div className="globe-coordinates">
          {formatCoordinates(state.hoveredLocation.lat, state.hoveredLocation.lng)}
        </div>
      )}

      <div className="globe-controls-hint">
        <p>🖱️ Drag to rotate • Scroll to zoom • Click to select location</p>
      </div>
    </div>
  );
}

export default Globe;
