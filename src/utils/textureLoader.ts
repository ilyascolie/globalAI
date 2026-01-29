import * as THREE from 'three';

// Texture URLs - using NASA Blue Marble and Earth at Night imagery
// These are public domain images from NASA
const TEXTURE_URLS = {
  // Higher resolution options - uncomment preferred resolution
  day: 'https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg',
  night: 'https://unpkg.com/three-globe/example/img/earth-night.jpg',
  // Bump map for terrain elevation
  bump: 'https://unpkg.com/three-globe/example/img/earth-topology.png',
  // Specular map for water reflections
  specular: 'https://unpkg.com/three-globe/example/img/earth-water.png',
  // Clouds layer (optional)
  clouds: 'https://unpkg.com/three-globe/example/img/earth-clouds.png',
};

// Cache for loaded textures
const textureCache: Map<string, THREE.Texture> = new Map();

// Loading manager for tracking progress
const loadingManager = new THREE.LoadingManager();
const textureLoader = new THREE.TextureLoader(loadingManager);

interface LoadingCallbacks {
  onProgress?: (loaded: number, total: number) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Load a texture with caching and lazy loading
 */
export async function loadTexture(
  url: string,
  callbacks?: LoadingCallbacks
): Promise<THREE.Texture> {
  // Check cache first
  if (textureCache.has(url)) {
    return textureCache.get(url)!;
  }

  return new Promise((resolve, reject) => {
    textureLoader.load(
      url,
      (texture) => {
        // Configure texture for better quality
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = 16;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.generateMipmaps = true;

        // Cache the texture
        textureCache.set(url, texture);

        callbacks?.onComplete?.();
        resolve(texture);
      },
      (progress) => {
        if (progress.lengthComputable) {
          callbacks?.onProgress?.(progress.loaded, progress.total);
        }
      },
      () => {
        const err = new Error(`Failed to load texture: ${url}`);
        callbacks?.onError?.(err);
        reject(err);
      }
    );
  });
}

/**
 * Load all earth textures with progress tracking
 */
export async function loadEarthTextures(
  callbacks?: LoadingCallbacks
): Promise<{
  dayTexture: THREE.Texture;
  nightTexture: THREE.Texture;
  bumpTexture?: THREE.Texture;
  specularTexture?: THREE.Texture;
  cloudsTexture?: THREE.Texture;
}> {
  let loadedCount = 0;
  const totalTextures = 2; // Required textures

  const updateProgress = () => {
    loadedCount++;
    callbacks?.onProgress?.(loadedCount, totalTextures);
  };

  try {
    // Load required textures in parallel
    const [dayTexture, nightTexture] = await Promise.all([
      loadTexture(TEXTURE_URLS.day, { onComplete: updateProgress }),
      loadTexture(TEXTURE_URLS.night, { onComplete: updateProgress }),
    ]);

    callbacks?.onComplete?.();

    return {
      dayTexture,
      nightTexture,
    };
  } catch (error) {
    callbacks?.onError?.(error as Error);
    throw error;
  }
}

/**
 * Load optional textures (bump, specular, clouds) for enhanced visuals
 */
export async function loadEnhancedTextures(): Promise<{
  bumpTexture?: THREE.Texture;
  specularTexture?: THREE.Texture;
  cloudsTexture?: THREE.Texture;
}> {
  const results: {
    bumpTexture?: THREE.Texture;
    specularTexture?: THREE.Texture;
    cloudsTexture?: THREE.Texture;
  } = {};

  // Load optional textures - don't fail if they don't load
  try {
    results.bumpTexture = await loadTexture(TEXTURE_URLS.bump);
  } catch {
    console.warn('Bump texture not loaded');
  }

  try {
    results.specularTexture = await loadTexture(TEXTURE_URLS.specular);
  } catch {
    console.warn('Specular texture not loaded');
  }

  try {
    results.cloudsTexture = await loadTexture(TEXTURE_URLS.clouds);
  } catch {
    console.warn('Clouds texture not loaded');
  }

  return results;
}

/**
 * Dispose of all cached textures to free memory
 */
export function disposeTextures(): void {
  textureCache.forEach((texture) => {
    texture.dispose();
  });
  textureCache.clear();
}

/**
 * Create a placeholder texture while loading
 */
export function createPlaceholderTexture(color: number = 0x1a1a2e): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = 2;
  canvas.height = 2;

  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
  ctx.fillRect(0, 0, 2, 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;

  return texture;
}
