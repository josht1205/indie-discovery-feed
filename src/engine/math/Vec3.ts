// Vec3 — 3D vector (used for 3D audio positioning & future 3D support)
export class Vec3 {
  constructor(public x = 0, public y = 0, public z = 0) {}

  static zero()    { return new Vec3(0, 0, 0); }
  static one()     { return new Vec3(1, 1, 1); }
  static up()      { return new Vec3(0, 1, 0); }
  static forward() { return new Vec3(0, 0, -1); }
  static right()   { return new Vec3(1, 0, 0); }

  clone() { return new Vec3(this.x, this.y, this.z); }

  add(v: Vec3)   { return new Vec3(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v: Vec3)   { return new Vec3(this.x - v.x, this.y - v.y, this.z - v.z); }
  mul(s: number) { return new Vec3(this.x * s, this.y * s, this.z * s); }
  div(s: number) { return new Vec3(this.x / s, this.y / s, this.z / s); }

  addEq(v: Vec3): this  { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  mulEq(s: number): this{ this.x *= s; this.y *= s; this.z *= s; return this; }

  dot(v: Vec3)   { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v: Vec3) {
    return new Vec3(
      this.y * v.z - this.z * v.y,
      this.z * v.x - this.x * v.z,
      this.x * v.y - this.y * v.x,
    );
  }

  lengthSq() { return this.x ** 2 + this.y ** 2 + this.z ** 2; }
  length()   { return Math.sqrt(this.lengthSq()); }

  normalize(): Vec3 {
    const len = this.length();
    return len > 1e-8 ? this.div(len) : Vec3.zero();
  }

  lerp(to: Vec3, t: number) {
    return new Vec3(
      this.x + (to.x - this.x) * t,
      this.y + (to.y - this.y) * t,
      this.z + (to.z - this.z) * t,
    );
  }

  distanceTo(v: Vec3) { return this.sub(v).length(); }
  negate() { return new Vec3(-this.x, -this.y, -this.z); }

  toArray(): [number, number, number] { return [this.x, this.y, this.z]; }
  toString() { return `Vec3(${this.x.toFixed(3)}, ${this.y.toFixed(3)}, ${this.z.toFixed(3)})`; }

  set(x: number, y: number, z: number): this { this.x = x; this.y = y; this.z = z; return this; }
  copy(v: Vec3): this { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}
