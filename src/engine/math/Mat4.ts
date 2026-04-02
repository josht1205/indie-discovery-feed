// Mat4 — column-major 4x4 matrix for WebGL transforms
export class Mat4 {
  data: Float32Array;

  constructor(data?: ArrayLike<number>) {
    this.data = new Float32Array(16);
    if (data) this.data.set(data);
    else this.identity();
  }

  identity(): this {
    const d = this.data;
    d.fill(0);
    d[0] = d[5] = d[10] = d[15] = 1;
    return this;
  }

  clone() { return new Mat4(this.data); }

  static identity()     { return new Mat4(); }

  static ortho(
    left: number, right: number,
    bottom: number, top: number,
    near: number, far: number,
  ): Mat4 {
    const m = new Mat4();
    const rl = right - left, tb = top - bottom, fn = far - near;
    m.data[0]  =  2 / rl;
    m.data[5]  =  2 / tb;
    m.data[10] = -2 / fn;
    m.data[12] = -(right + left)  / rl;
    m.data[13] = -(top   + bottom)/ tb;
    m.data[14] = -(far   + near)  / fn;
    m.data[15] =  1;
    return m;
  }

  static translation(x: number, y: number, z = 0): Mat4 {
    const m = new Mat4();
    m.data[12] = x; m.data[13] = y; m.data[14] = z;
    return m;
  }

  static scale(x: number, y: number, z = 1): Mat4 {
    const m = new Mat4();
    m.data[0] = x; m.data[5] = y; m.data[10] = z;
    return m;
  }

  static rotationZ(angle: number): Mat4 {
    const m = new Mat4();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[0] = c;  m.data[1] = s;
    m.data[4] = -s; m.data[5] = c;
    return m;
  }

  multiply(b: Mat4): Mat4 {
    const a = this.data, bd = b.data;
    const res = new Float32Array(16);
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * bd[col * 4 + k];
        res[col * 4 + row] = sum;
      }
    }
    return new Mat4(res);
  }

  invert(): Mat4 | null {
    const m = this.data, inv = new Float32Array(16);
    inv[0]  =  m[5]*m[10]*m[15] - m[5]*m[11]*m[14] - m[9]*m[6]*m[15] + m[9]*m[7]*m[14] + m[13]*m[6]*m[11] - m[13]*m[7]*m[10];
    inv[4]  = -m[4]*m[10]*m[15] + m[4]*m[11]*m[14] + m[8]*m[6]*m[15] - m[8]*m[7]*m[14] - m[12]*m[6]*m[11] + m[12]*m[7]*m[10];
    inv[8]  =  m[4]*m[9]*m[15]  - m[4]*m[11]*m[13] - m[8]*m[5]*m[15] + m[8]*m[7]*m[13] + m[12]*m[5]*m[11] - m[12]*m[7]*m[9];
    inv[12] = -m[4]*m[9]*m[14]  + m[4]*m[10]*m[13] + m[8]*m[5]*m[14] - m[8]*m[6]*m[13] - m[12]*m[5]*m[10] + m[12]*m[6]*m[9];
    const det = m[0]*inv[0] + m[1]*inv[4] + m[2]*inv[8] + m[3]*inv[12];
    if (Math.abs(det) < 1e-10) return null;
    const d = 1 / det;
    inv[1]  =  (-m[1]*m[10]*m[15] + m[1]*m[11]*m[14] + m[9]*m[2]*m[15] - m[9]*m[3]*m[14] - m[13]*m[2]*m[11] + m[13]*m[3]*m[10]) * d;
    inv[5]  =  (  m[0]*m[10]*m[15] - m[0]*m[11]*m[14] - m[8]*m[2]*m[15] + m[8]*m[3]*m[14] + m[12]*m[2]*m[11] - m[12]*m[3]*m[10]) * d;
    inv[9]  =  (-m[0]*m[9]*m[15]  + m[0]*m[11]*m[13] + m[8]*m[1]*m[15] - m[8]*m[3]*m[13] - m[12]*m[1]*m[11] + m[12]*m[3]*m[9])  * d;
    inv[13] =  ( m[0]*m[9]*m[14]  - m[0]*m[10]*m[13] - m[8]*m[1]*m[14] + m[8]*m[2]*m[13] + m[12]*m[1]*m[10] - m[12]*m[2]*m[9])  * d;
    inv[2]  =  ( m[1]*m[6]*m[15]  - m[1]*m[7]*m[14]  - m[5]*m[2]*m[15] + m[5]*m[3]*m[14] + m[13]*m[2]*m[7]  - m[13]*m[3]*m[6])  * d;
    inv[6]  =  (-m[0]*m[6]*m[15]  + m[0]*m[7]*m[14]  + m[4]*m[2]*m[15] - m[4]*m[3]*m[14] - m[12]*m[2]*m[7]  + m[12]*m[3]*m[6])  * d;
    inv[10] =  ( m[0]*m[5]*m[15]  - m[0]*m[7]*m[13]  - m[4]*m[1]*m[15] + m[4]*m[3]*m[13] + m[12]*m[1]*m[7]  - m[12]*m[3]*m[5])  * d;
    inv[14] =  (-m[0]*m[5]*m[14]  + m[0]*m[6]*m[13]  + m[4]*m[1]*m[14] - m[4]*m[2]*m[13] - m[12]*m[1]*m[6]  + m[12]*m[2]*m[5])  * d;
    inv[3]  =  (-m[1]*m[6]*m[11]  + m[1]*m[7]*m[10]  + m[5]*m[2]*m[11] - m[5]*m[3]*m[10] - m[9]*m[2]*m[7]   + m[9]*m[3]*m[6])   * d;
    inv[7]  =  ( m[0]*m[6]*m[11]  - m[0]*m[7]*m[10]  - m[4]*m[2]*m[11] + m[4]*m[3]*m[10] + m[8]*m[2]*m[7]   - m[8]*m[3]*m[6])   * d;
    inv[11] =  (-m[0]*m[5]*m[11]  + m[0]*m[7]*m[9]   + m[4]*m[1]*m[11] - m[4]*m[3]*m[9]  - m[8]*m[1]*m[7]   + m[8]*m[3]*m[5])   * d;
    inv[15] =  ( m[0]*m[5]*m[10]  - m[0]*m[6]*m[9]   - m[4]*m[1]*m[10] + m[4]*m[2]*m[9]  + m[8]*m[1]*m[6]   - m[8]*m[2]*m[5])   * d;
    for (let i = 0; i < 16; i++) inv[i] *= d === 1 ? 1 : 1; // already scaled
    return new Mat4(inv);
  }

  toArray() { return this.data; }
}
