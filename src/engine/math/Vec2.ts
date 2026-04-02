// Vec2 — immutable-friendly 2D vector
export class Vec2 {
  constructor(public x = 0, public y = 0) {}

  static zero()  { return new Vec2(0, 0); }
  static one()   { return new Vec2(1, 1); }
  static up()    { return new Vec2(0, 1); }
  static right() { return new Vec2(1, 0); }

  clone() { return new Vec2(this.x, this.y); }

  add(v: Vec2)  { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: Vec2)  { return new Vec2(this.x - v.x, this.y - v.y); }
  mul(s: number){ return new Vec2(this.x * s, this.y * s); }
  div(s: number){ return new Vec2(this.x / s, this.y / s); }

  addEq(v: Vec2): this  { this.x += v.x; this.y += v.y; return this; }
  subEq(v: Vec2): this  { this.x -= v.x; this.y -= v.y; return this; }
  mulEq(s: number): this{ this.x *= s;   this.y *= s;   return this; }

  dot(v: Vec2)  { return this.x * v.x + this.y * v.y; }
  cross(v: Vec2){ return this.x * v.y - this.y * v.x; }

  lengthSq()    { return this.x * this.x + this.y * this.y; }
  length()      { return Math.sqrt(this.lengthSq()); }

  normalize(): Vec2 {
    const len = this.length();
    return len > 1e-8 ? this.div(len) : Vec2.zero();
  }

  perpendicular() { return new Vec2(-this.y, this.x); }

  lerp(to: Vec2, t: number) {
    return new Vec2(this.x + (to.x - this.x) * t, this.y + (to.y - this.y) * t);
  }

  distanceTo(v: Vec2) { return this.sub(v).length(); }

  angle()         { return Math.atan2(this.y, this.x); }
  rotate(a: number) {
    const c = Math.cos(a), s = Math.sin(a);
    return new Vec2(this.x * c - this.y * s, this.x * s + this.y * c);
  }

  negate() { return new Vec2(-this.x, -this.y); }
  abs()    { return new Vec2(Math.abs(this.x), Math.abs(this.y)); }

  static fromAngle(a: number, len = 1) {
    return new Vec2(Math.cos(a) * len, Math.sin(a) * len);
  }

  toString() { return `Vec2(${this.x.toFixed(3)}, ${this.y.toFixed(3)})`; }

  equals(v: Vec2, eps = 1e-6) {
    return Math.abs(this.x - v.x) < eps && Math.abs(this.y - v.y) < eps;
  }

  toArray(): [number, number] { return [this.x, this.y]; }

  set(x: number, y: number): this { this.x = x; this.y = y; return this; }

  copy(v: Vec2): this { this.x = v.x; this.y = v.y; return this; }
}
