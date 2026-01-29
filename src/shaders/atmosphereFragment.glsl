uniform vec3 sunDirection;

varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    // Calculate view direction
    vec3 viewDirection = normalize(-vPosition);

    // Fresnel effect for atmospheric glow
    float fresnel = pow(1.0 - dot(vNormal, viewDirection), 3.0);

    // Sun-facing intensity
    float sunIntensity = max(0.0, dot(vNormal, sunDirection));

    // Atmospheric color (blue with slight tint based on sun)
    vec3 dayAtmosphere = vec3(0.3, 0.6, 1.0);
    vec3 nightAtmosphere = vec3(0.1, 0.15, 0.3);
    vec3 atmosphereColor = mix(nightAtmosphere, dayAtmosphere, sunIntensity * 0.5 + 0.5);

    // Final color with fresnel
    float alpha = fresnel * 0.6;

    gl_FragColor = vec4(atmosphereColor, alpha);
}
