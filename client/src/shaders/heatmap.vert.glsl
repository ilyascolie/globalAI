// Heatmap Vertex Shader
// Renders on a sphere slightly larger than the globe to overlay the heatmap

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
