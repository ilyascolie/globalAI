// Heatmap Fragment Shader
// Custom shader-based heatmap with color gradient and pulse effects

precision highp float;

uniform sampler2D uDataTexture;      // 360x180 intensity texture
uniform vec3 uColorRamp[5];          // Color gradient stops
uniform float uColorPositions[5];    // Position of each color stop
uniform float uOpacity;              // Global opacity
uniform float uTime;                 // Animation time
uniform vec3 uPulsePositions[10];    // Up to 10 pulse locations (lat, lng, startTime)
uniform float uPulseIntensities[10]; // Intensity for each pulse
uniform int uPulseCount;             // Active pulse count
uniform float uIntensityMultiplier;  // Sensitivity control

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

// Convert 3D position to lat/lng UV coordinates
vec2 positionToUV(vec3 pos) {
  vec3 normalized = normalize(pos);
  float lng = atan(normalized.x, normalized.z);
  float lat = asin(normalized.y);

  // Convert to 0-1 UV range
  float u = (lng + 3.14159265359) / (2.0 * 3.14159265359);
  float v = (lat + 1.5707963268) / 3.14159265359;

  return vec2(u, v);
}

// Sample intensity with bilinear interpolation
float sampleIntensity(vec2 uv) {
  // Wrap UV coordinates
  uv.x = fract(uv.x);
  uv.y = clamp(uv.y, 0.0, 1.0);

  return texture2D(uDataTexture, uv).r;
}

// Gaussian blur for smooth interpolation
float smoothSample(vec2 uv, float radius) {
  float sum = 0.0;
  float totalWeight = 0.0;

  // Sample in a small kernel for smoothing
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

// Map intensity to color using gradient
vec3 intensityToColor(float intensity) {
  // Clamp intensity
  intensity = clamp(intensity, 0.0, 1.0);

  // Find color segment
  vec3 color = uColorRamp[0];

  for (int i = 0; i < 4; i++) {
    if (intensity >= uColorPositions[i] && intensity <= uColorPositions[i + 1]) {
      float t = (intensity - uColorPositions[i]) / (uColorPositions[i + 1] - uColorPositions[i]);
      t = smoothstep(0.0, 1.0, t); // Smooth interpolation
      color = mix(uColorRamp[i], uColorRamp[i + 1], t);
      break;
    }
  }

  return color;
}

// Calculate pulse effect at a position
float calculatePulse(vec2 uv) {
  float pulseEffect = 0.0;

  for (int i = 0; i < 10; i++) {
    if (i >= uPulseCount) break;

    vec3 pulseData = uPulsePositions[i];
    float pulseLat = pulseData.x;
    float pulseLng = pulseData.y;
    float pulseStartTime = pulseData.z;

    // Convert pulse lat/lng to UV
    float pulseU = (pulseLng + 180.0) / 360.0;
    float pulseV = (pulseLat + 90.0) / 180.0;
    vec2 pulseUV = vec2(pulseU, pulseV);

    // Distance from pulse center (accounting for wrap-around)
    float dx = abs(uv.x - pulseUV.x);
    dx = min(dx, 1.0 - dx); // Handle wrap
    float dy = uv.y - pulseUV.y;
    float dist = sqrt(dx * dx + dy * dy);

    // Pulse ring animation
    float timeSinceStart = uTime - pulseStartTime;
    float pulseRadius = timeSinceStart * 0.1; // Expand rate
    float ringWidth = 0.02;

    // Fade out over time
    float fade = 1.0 - smoothstep(0.0, 3.0, timeSinceStart);

    // Ring effect
    float ring = smoothstep(pulseRadius - ringWidth, pulseRadius, dist) *
                 smoothstep(pulseRadius + ringWidth, pulseRadius, dist);

    pulseEffect += ring * fade * uPulseIntensities[i];
  }

  return pulseEffect;
}

void main() {
  // Convert position to UV coordinates
  vec2 uv = positionToUV(vPosition);

  // Sample intensity with smoothing
  float rawIntensity = smoothSample(uv, 0.003);

  // Apply intensity multiplier (sensitivity)
  float intensity = rawIntensity * uIntensityMultiplier;

  // Add pulse effects
  float pulse = calculatePulse(uv);
  intensity += pulse * 0.5;

  // Map to color
  vec3 color = intensityToColor(intensity);

  // Calculate alpha based on intensity
  float alpha = intensity * uOpacity;

  // Add subtle glow effect for high intensity areas
  float glow = smoothstep(0.5, 1.0, intensity) * 0.3;
  color += vec3(glow);

  // Fresnel effect for edge glow
  vec3 viewDir = normalize(cameraPosition - vPosition);
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0);
  alpha *= (1.0 - fresnel * 0.5);

  // Discard very low intensity pixels
  if (alpha < 0.01) discard;

  gl_FragColor = vec4(color, alpha);
}
