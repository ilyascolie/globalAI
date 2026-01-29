// GLSL Shader exports
// These are loaded as raw strings via Vite's ?raw import

export const heatmapVertexShader = `
// Heatmap Vertex Shader
varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vPosition = position;

  // Position slightly above globe surface to prevent z-fighting
  vec3 newPosition = position * 1.002;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
}
`;

export const heatmapFragmentShader = `
// Heatmap Fragment Shader
precision highp float;

uniform sampler2D uDataTexture;
uniform vec3 uColorRamp[5];
uniform float uColorPositions[5];
uniform float uOpacity;
uniform float uTime;
uniform vec3 uPulsePositions[10];
uniform float uPulseIntensities[10];
uniform int uPulseCount;
uniform float uIntensityMultiplier;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

vec2 positionToUV(vec3 pos) {
  vec3 normalized = normalize(pos);
  float lng = atan(normalized.x, normalized.z);
  float lat = asin(normalized.y);

  float u = (lng + 3.14159265359) / (2.0 * 3.14159265359);
  float v = (lat + 1.5707963268) / 3.14159265359;

  return vec2(u, v);
}

float sampleIntensity(vec2 uv) {
  uv.x = fract(uv.x);
  uv.y = clamp(uv.y, 0.0, 1.0);
  return texture2D(uDataTexture, uv).r;
}

float smoothSample(vec2 uv, float radius) {
  float sum = 0.0;
  float totalWeight = 0.0;

  for (float dx = -2.0; dx <= 2.0; dx += 1.0) {
    for (float dy = -2.0; dy <= 2.0; dy += 1.0) {
      vec2 offset = vec2(dx, dy) * radius;
      vec2 sampleUV = uv + offset;

      float weight = exp(-(dx*dx + dy*dy) / 2.0);
      sum += sampleIntensity(sampleUV) * weight;
      totalWeight += weight;
    }
  }

  return sum / totalWeight;
}

vec3 intensityToColor(float intensity) {
  intensity = clamp(intensity, 0.0, 1.0);
  vec3 color = uColorRamp[0];

  for (int i = 0; i < 4; i++) {
    if (intensity >= uColorPositions[i] && intensity <= uColorPositions[i + 1]) {
      float t = (intensity - uColorPositions[i]) / (uColorPositions[i + 1] - uColorPositions[i]);
      t = smoothstep(0.0, 1.0, t);
      color = mix(uColorRamp[i], uColorRamp[i + 1], t);
      break;
    }
  }

  return color;
}

float calculatePulse(vec2 uv) {
  float pulseEffect = 0.0;

  for (int i = 0; i < 10; i++) {
    if (i >= uPulseCount) break;

    vec3 pulseData = uPulsePositions[i];
    float pulseLat = pulseData.x;
    float pulseLng = pulseData.y;
    float pulseStartTime = pulseData.z;

    float pulseU = (pulseLng + 180.0) / 360.0;
    float pulseV = (pulseLat + 90.0) / 180.0;
    vec2 pulseUV = vec2(pulseU, pulseV);

    float dx = abs(uv.x - pulseUV.x);
    dx = min(dx, 1.0 - dx);
    float dy = uv.y - pulseUV.y;
    float dist = sqrt(dx * dx + dy * dy);

    float timeSinceStart = uTime - pulseStartTime;
    float pulseRadius = timeSinceStart * 0.1;
    float ringWidth = 0.02;

    float fade = 1.0 - smoothstep(0.0, 3.0, timeSinceStart);

    float ring = smoothstep(pulseRadius - ringWidth, pulseRadius, dist) *
                 smoothstep(pulseRadius + ringWidth, pulseRadius, dist);

    pulseEffect += ring * fade * uPulseIntensities[i];
  }

  return pulseEffect;
}

void main() {
  vec2 uv = positionToUV(vPosition);
  float rawIntensity = smoothSample(uv, 0.003);
  float intensity = rawIntensity * uIntensityMultiplier;

  float pulse = calculatePulse(uv);
  intensity += pulse * 0.5;

  vec3 color = intensityToColor(intensity);
  float alpha = intensity * uOpacity;

  float glow = smoothstep(0.5, 1.0, intensity) * 0.3;
  color += vec3(glow);

  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);
  alpha *= (1.0 - fresnel * 0.5);

  if (alpha < 0.01) discard;

  gl_FragColor = vec4(color, alpha);
}
`;

export const atmosphereVertexShader = `
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vNormal = normalize(normalMatrix * normal);
  vPosition = (modelMatrix * vec4(position, 1.0)).xyz;

  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const atmosphereFragmentShader = `
precision highp float;

uniform vec3 uGlowColor;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

  vec3 color = uGlowColor * fresnel * uIntensity;
  float alpha = fresnel * uIntensity * 0.6;

  gl_FragColor = vec4(color, alpha);
}
`;

// Default heatmap color gradient (blue -> yellow -> orange -> red)
export const DEFAULT_COLOR_RAMP = [
  [0.0, 0.2, 0.8],   // Blue (low)
  [0.0, 0.7, 0.9],   // Cyan
  [1.0, 0.9, 0.0],   // Yellow
  [1.0, 0.5, 0.0],   // Orange
  [1.0, 0.0, 0.0],   // Red (high)
] as const;

export const DEFAULT_COLOR_POSITIONS = [0.0, 0.25, 0.5, 0.75, 1.0];
