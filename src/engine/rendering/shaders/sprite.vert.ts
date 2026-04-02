// Vertex shader for sprite batch rendering
export const SPRITE_VERT = `#version 300 es
precision highp float;

// Per-vertex
in vec2 a_position;
in vec2 a_texCoord;

// Per-instance (mat3 packed as 3 vec4s + color)
in vec4 a_model0;   // column 0 of model mat3
in vec4 a_model1;   // column 1 of model mat3
in vec4 a_model2;   // column 2 (x,y = translation)
in vec4 a_color;    // tint rgba
in vec4 a_uvRect;   // x,y = uvOffset, z,w = uvScale

uniform mat4 u_projection;
uniform mat4 u_view;

out vec2 v_texCoord;
out vec4 v_color;

void main() {
  // Reconstruct 3x3 model matrix from instanced columns
  mat3 model = mat3(
    a_model0.xy, 0.0,
    a_model1.xy, 0.0,
    a_model2.xy, 1.0
  );

  vec2 worldPos = (model * vec3(a_position, 1.0)).xy;
  gl_Position   = u_projection * u_view * vec4(worldPos, 0.0, 1.0);

  // Map UV to the sub-rect of the sprite atlas
  v_texCoord = a_uvRect.xy + a_texCoord * a_uvRect.zw;
  v_color    = a_color;
}
`;
