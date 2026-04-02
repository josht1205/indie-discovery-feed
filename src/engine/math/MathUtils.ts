// MathUtils — common math helpers used across engine systems
export const MathUtils = {
  DEG2RAD: Math.PI / 180,
  RAD2DEG: 180 / Math.PI,
  TWO_PI:  Math.PI * 2,

  clamp(v: number, min: number, max: number): number {
    return v < min ? min : v > max ? max : v;
  },

  lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
  },

  smoothstep(edge0: number, edge1: number, x: number): number {
    const t = MathUtils.clamp((x - edge0) / (edge1 - edge0), 0, 1);
    return t * t * (3 - 2 * t);
  },

  remap(v: number, in0: number, in1: number, out0: number, out1: number): number {
    return out0 + ((v - in0) / (in1 - in0)) * (out1 - out0);
  },

  toRad(deg: number): number { return deg * MathUtils.DEG2RAD; },
  toDeg(rad: number): number { return rad * MathUtils.RAD2DEG; },

  // Power-of-two check (useful for textures)
  isPow2(v: number): boolean { return (v & (v - 1)) === 0; },
  nextPow2(v: number): number {
    let n = 1;
    while (n < v) n <<= 1;
    return n;
  },

  // Integer range random
  randInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  },
  randFloat(min: number, max: number): number {
    return min + Math.random() * (max - min);
  },

  // Angle helpers
  wrapAngle(a: number): number {
    while (a >  Math.PI) a -= MathUtils.TWO_PI;
    while (a < -Math.PI) a += MathUtils.TWO_PI;
    return a;
  },
  angleDiff(from: number, to: number): number {
    return MathUtils.wrapAngle(to - from);
  },

  // Approximately equal
  approx(a: number, b: number, eps = 1e-6): boolean {
    return Math.abs(a - b) < eps;
  },

  // Oscillator
  pingpong(t: number, len: number): number {
    const l2 = len * 2;
    const r  = t % l2;
    return r > len ? l2 - r : r;
  },

  sign(v: number): number { return v < 0 ? -1 : v > 0 ? 1 : 0; },
};
