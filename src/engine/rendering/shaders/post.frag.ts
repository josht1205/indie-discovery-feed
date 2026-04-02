// Post-processing fragment shader
// Supports: bloom threshold, vignette, chromatic aberration, CRT scanlines
export const POST_VERT = `#version 300 es
precision highp float;
in vec2 a_position;
out vec2 v_uv;
void main() {
  v_uv = a_position * 0.5 + 0.5;
  gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

export const POST_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_scene;
uniform float u_time;

// Post FX toggles & params
uniform float u_bloomIntensity;     // 0 = off
uniform float u_vignetteStrength;   // 0 = off, 1 = strong
uniform float u_chromaticAberration;// 0 = off, max ~0.01
uniform float u_scanlineIntensity;  // 0 = off
uniform float u_saturation;         // 1 = normal
uniform float u_contrast;           // 1 = normal
uniform float u_brightness;         // 0 = normal

vec3 adjustColor(vec3 color) {
  // Brightness
  color += u_brightness;
  // Contrast
  color = (color - 0.5) * u_contrast + 0.5;
  // Saturation via luminance
  float lum = dot(color, vec3(0.299, 0.587, 0.114));
  color = mix(vec3(lum), color, u_saturation);
  return clamp(color, 0.0, 1.0);
}

vec3 bloomSample(sampler2D tex, vec2 uv) {
  // Simple 9-tap box blur for bloom approximation
  vec2 texel = vec2(1.0) / vec2(textureSize(tex, 0));
  vec3 sum = vec3(0.0);
  for (int x = -2; x <= 2; x++) {
    for (int y = -2; y <= 2; y++) {
      sum += texture(tex, uv + vec2(x, y) * texel * 2.0).rgb;
    }
  }
  return sum / 25.0;
}

void main() {
  vec2 uv = v_uv;

  // Chromatic aberration
  float ca = u_chromaticAberration;
  vec4 color;
  color.r = texture(u_scene, uv + vec2( ca, 0.0)).r;
  color.g = texture(u_scene, uv              ).g;
  color.b = texture(u_scene, uv - vec2( ca, 0.0)).b;
  color.a = texture(u_scene, uv).a;

  // Bloom
  if (u_bloomIntensity > 0.0) {
    vec3 bright = max(color.rgb - 0.7, 0.0);
    vec3 blur   = bloomSample(u_scene, uv);
    color.rgb  += blur * bright * u_bloomIntensity;
  }

  // CRT scanlines
  if (u_scanlineIntensity > 0.0) {
    float scanline = sin(uv.y * 800.0) * 0.5 + 0.5;
    color.rgb *= mix(1.0, scanline, u_scanlineIntensity);
  }

  // Vignette
  if (u_vignetteStrength > 0.0) {
    vec2 d    = v_uv - 0.5;
    float vig = 1.0 - dot(d, d) * u_vignetteStrength * 4.0;
    color.rgb *= clamp(vig, 0.0, 1.0);
  }

  color.rgb = adjustColor(color.rgb);

  outColor = color;
}
`;
