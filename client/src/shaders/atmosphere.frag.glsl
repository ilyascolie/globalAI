// Atmosphere Fragment Shader
// Creates atmospheric glow effect

precision highp float;

uniform vec3 uGlowColor;
uniform float uIntensity;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
  vec3 viewDir = normalize(cameraPosition - vPosition);

  // Fresnel effect - stronger glow at edges
  float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 3.0);

  // Atmosphere color with glow
  vec3 color = uGlowColor * fresnel * uIntensity;
  float alpha = fresnel * uIntensity * 0.6;

  gl_FragColor = vec4(color, alpha);
}
