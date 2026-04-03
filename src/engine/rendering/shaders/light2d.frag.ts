// 2D Deferred lighting pass — accumulates point lights onto a light map FBO
// UE5 Lumen concept applied to 2D: deferred light accumulation + normal map support
export const LIGHT2D_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

// Scene textures from G-buffer
uniform sampler2D u_colorTex;    // albedo / sprite color
uniform sampler2D u_normalTex;   // normal map (rgb = world normal, optional)
uniform sampler2D u_lightTex;    // accumulated light buffer

// Global ambient
uniform vec3  u_ambient;

// Whether to use the normal map
uniform bool u_useNormals;

void main() {
  vec4 albedo = texture(u_colorTex, v_uv);
  vec4 light  = texture(u_lightTex, v_uv);

  // Combine albedo with accumulated light + ambient
  vec3 finalColor = albedo.rgb * (u_ambient + light.rgb);

  outColor = vec4(finalColor, albedo.a);
}
`;

// Point-light accumulation (additive pass — one draw per light)
export const POINT_LIGHT_FRAG = `#version 300 es
precision highp float;

in vec2 v_uv;
out vec4 outColor;

uniform sampler2D u_normalTex;    // optional normal map from G-buffer
uniform vec2  u_lightPos;         // light world position (in screen UV space)
uniform vec3  u_lightColor;       // rgb
uniform float u_lightRadius;      // pixels
uniform float u_lightIntensity;
uniform float u_lightZ;           // light Z height for normal-map shading
uniform bool  u_useNormals;
uniform vec2  u_resolution;

void main() {
  vec2 fragPos = v_uv * u_resolution;
  vec2 lightPos = u_lightPos;

  float dist = distance(fragPos, lightPos);
  if (dist > u_lightRadius) { outColor = vec4(0.0); return; }

  // Inverse-square attenuation (physically accurate)
  float attenuation = 1.0 - (dist / u_lightRadius);
  attenuation = attenuation * attenuation;

  vec3 lightContrib = u_lightColor * u_lightIntensity * attenuation;

  // Normal-map contribution
  if (u_useNormals) {
    vec4 normalSample = texture(u_normalTex, v_uv);
    vec3 normal = normalize(normalSample.rgb * 2.0 - 1.0);
    vec3 lightDir = normalize(vec3(lightPos - fragPos, u_lightZ));
    float nDotL = max(dot(normal, lightDir), 0.0);
    lightContrib *= nDotL;
  }

  outColor = vec4(lightContrib, 1.0);
}
`;
