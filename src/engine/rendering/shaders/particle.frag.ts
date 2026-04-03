// Particle fragment shader — soft-edge dissolve + additive/alpha blend support
export const PARTICLE_FRAG = `#version 300 es
precision highp float;

in vec2  v_texCoord;
in vec4  v_color;
in float v_life;

uniform sampler2D u_texture;
uniform float u_softEdge;   // 0 = hard, 1 = soft fade at edges
uniform int   u_blendMode;  // 0=alpha, 1=additive, 2=multiply

out vec4 outColor;

void main() {
  vec4 tex  = texture(u_texture, v_texCoord);
  vec4 col  = tex * v_color;

  // Soft edge: fade out particles at edge of their UV based on life
  if (u_softEdge > 0.0) {
    vec2 uv = v_texCoord * 2.0 - 1.0;
    float edge = 1.0 - smoothstep(0.7, 1.0, length(uv));
    col.a *= edge;
  }

  // Fade near end of life
  col.a *= smoothstep(0.0, 0.1, v_life) * smoothstep(1.0, 0.85, v_life);

  if (col.a < 0.01) discard;

  outColor = col;
}
`;
