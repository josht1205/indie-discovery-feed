// Transform — position, rotation, scale component stored per entity
import { Vec2 } from './Vec2';
import { Mat4 } from './Mat4';

export class Transform {
  position: Vec2;
  rotation: number;   // radians
  scale:    Vec2;

  // Previous frame values used for render interpolation
  prevPosition: Vec2;
  prevRotation: number;

  constructor(
    x = 0, y = 0,
    rotation = 0,
    sx = 1, sy = 1,
  ) {
    this.position     = new Vec2(x, y);
    this.rotation     = rotation;
    this.scale        = new Vec2(sx, sy);
    this.prevPosition = new Vec2(x, y);
    this.prevRotation = rotation;
  }

  // Call before physics/logic to snapshot previous state
  savePrev(): void {
    this.prevPosition.copy(this.position);
    this.prevRotation = this.rotation;
  }

  // Linearly interpolated world transform for rendering
  interpolated(alpha: number): { x: number; y: number; rotation: number } {
    return {
      x:        this.prevPosition.x + (this.position.x - this.prevPosition.x) * alpha,
      y:        this.prevPosition.y + (this.position.y - this.prevPosition.y) * alpha,
      rotation: this.prevRotation   + (this.rotation   - this.prevRotation)   * alpha,
    };
  }

  toMatrix(alpha = 1): Mat4 {
    const interp = this.interpolated(alpha);
    const T = Mat4.translation(interp.x, interp.y, 0);
    const R = Mat4.rotationZ(interp.rotation);
    const S = Mat4.scale(this.scale.x, this.scale.y, 1);
    return T.multiply(R).multiply(S);
  }

  clone(): Transform {
    return new Transform(
      this.position.x, this.position.y,
      this.rotation,
      this.scale.x, this.scale.y,
    );
  }
}
