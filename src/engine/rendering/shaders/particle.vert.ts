// Particle vertex shader — GPU-side simulation via transform feedback (UE5 Niagara-style)
// Each particle is a single instanced quad; position/life updated on CPU in typed arrays
export const PARTICLE_VERT = `#version 300 es
precision highp float;

// Per-vertex (unit quad)
in vec2 a_position;
in vec2 a_texCoord;

// Per-instance particle data
in vec2  a_pos;           // world position
in float a_rotation;      // radians
in vec2  a_size;          // width, height
in vec4  a_color;         // rgba tint (animated over lifetime)
in float a_life;          // normalized life [0..1]
in vec4  a_uvRect;        // atlas sub-rect

uniform mat4 u_projection;
uniform mat4 u_view;

out vec2 v_texCoord;
out vec4 v_color;
out float v_life;

void main() {
  float c = cos(a_rotation);
  float s = sin(a_rotation);

  // Scale and rotate the unit quad
  vec2 scaled = a_position * a_size;
  vec2 rotated = vec2(
    scaled.x * c - scaled.y * s,
    scaled.x * s + scaled.y * c
  );

  vec4 worldPos = vec4(rotated + a_pos, 0.0, 1.0);
  gl_Position   = u_projection * u_view * worldPos;

  v_texCoord = a_uvRect.xy + a_texCoord * a_uvRect.zw;
  v_color    = a_color;
  v_life     = a_life;
}
`;
