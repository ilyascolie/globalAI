uniform sampler2D dayTexture;
uniform sampler2D nightTexture;
uniform vec3 sunDirection;

varying vec2 vUv;
varying vec3 vNormal;
varying vec3 vPosition;

void main() {
    // Calculate sun intensity based on the angle between surface normal and sun direction
    float intensity = dot(vNormal, sunDirection);

    // Create a smooth transition zone between day and night (terminator)
    float transition = smoothstep(-0.2, 0.3, intensity);

    // Sample both textures
    vec4 dayColor = texture2D(dayTexture, vUv);
    vec4 nightColor = texture2D(nightTexture, vUv);

    // Boost night lights visibility
    nightColor.rgb *= 1.5;

    // Mix between day and night based on sun position
    vec4 finalColor = mix(nightColor, dayColor, transition);

    // Add subtle atmospheric glow on the day side
    float atmosphere = pow(1.0 - abs(dot(vNormal, normalize(-vPosition))), 2.0);
    vec3 atmosphereColor = vec3(0.3, 0.6, 1.0) * atmosphere * 0.15 * max(0.0, intensity);

    finalColor.rgb += atmosphereColor;

    gl_FragColor = finalColor;
}
