// Fragment shader for sprite batch rendering
export const SPRITE_FRAG = `#version 300 es
precision highp float;

in vec2 v_texCoord;
in vec4 v_color;

uniform sampler2D u_texture;

out vec4 outColor;

void main() {
  vec4 texColor = texture(u_texture, v_texCoord);
  outColor = texColor * v_color;

  // Discard fully-transparent pixels (avoids z-write issues)
  if (outColor.a < 0.01) discard;
}
`;
