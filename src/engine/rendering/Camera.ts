// Camera — orthographic 2D camera with zoom, shake, and smooth follow
import { Vec2 } from '../math/Vec2';
import { Mat4 } from '../math/Mat4';
import { Component } from '../ecs/Component';
import { MathUtils } from '../math/MathUtils';

export class Camera extends Component {
  static readonly TYPE = 'Camera';

  position:   Vec2   = new Vec2();
  zoom:       number = 1;
  rotation:   number = 0;
  viewWidth:  number = 800;
  viewHeight: number = 600;

  // Smooth follow
  followTarget?: Vec2;
  followSpeed   = 5;

  // Shake
  private _shakeIntensity  = 0;
  private _shakeDuration   = 0;
  private _shakeTimer      = 0;
  private _shakeOffset     = new Vec2();

  // Bounds clamping
  bounds?: { minX: number; minY: number; maxX: number; maxY: number };

  shake(intensity: number, duration: number): void {
    this._shakeIntensity = intensity;
    this._shakeDuration  = duration;
    this._shakeTimer     = 0;
  }

  update(dt: number): void {
    // Smooth follow
    if (this.followTarget) {
      this.position = this.position.lerp(this.followTarget, Math.min(1, this.followSpeed * dt));
    }

    // Shake
    if (this._shakeTimer < this._shakeDuration) {
      this._shakeTimer += dt;
      const progress  = 1 - this._shakeTimer / this._shakeDuration;
      const intensity = this._shakeIntensity * progress;
      this._shakeOffset.set(
        MathUtils.randFloat(-intensity, intensity),
        MathUtils.randFloat(-intensity, intensity),
      );
    } else {
      this._shakeOffset.set(0, 0);
    }

    // Bounds clamp
    if (this.bounds) {
      const hw = (this.viewWidth  / 2) / this.zoom;
      const hh = (this.viewHeight / 2) / this.zoom;
      this.position.x = MathUtils.clamp(this.position.x, this.bounds.minX + hw, this.bounds.maxX - hw);
      this.position.y = MathUtils.clamp(this.position.y, this.bounds.minY + hh, this.bounds.maxY - hh);
    }
  }

  getProjectionMatrix(): Mat4 {
    const hw = (this.viewWidth  / 2) / this.zoom;
    const hh = (this.viewHeight / 2) / this.zoom;
    return Mat4.ortho(-hw, hw, -hh, hh, -1000, 1000);
  }

  getViewMatrix(): Mat4 {
    const x = this.position.x + this._shakeOffset.x;
    const y = this.position.y + this._shakeOffset.y;
    const T = Mat4.translation(-x, -y, 0);
    const R = Mat4.rotationZ(-this.rotation);
    return R.multiply(T);
  }

  /** Convert screen coords to world coords */
  screenToWorld(sx: number, sy: number): Vec2 {
    const ndcX =  (sx / this.viewWidth  - 0.5) * 2;
    const ndcY = -(sy / this.viewHeight - 0.5) * 2;
    const hw = (this.viewWidth  / 2) / this.zoom;
    const hh = (this.viewHeight / 2) / this.zoom;
    return new Vec2(
      this.position.x + ndcX * hw,
      this.position.y + ndcY * hh,
    );
  }

  /** Convert world coords to screen coords */
  worldToScreen(wx: number, wy: number): Vec2 {
    const hw = (this.viewWidth  / 2) / this.zoom;
    const hh = (this.viewHeight / 2) / this.zoom;
    const ndcX = (wx - this.position.x) / hw;
    const ndcY = (wy - this.position.y) / hh;
    return new Vec2(
      (ndcX * 0.5 + 0.5) * this.viewWidth,
      (-ndcY * 0.5 + 0.5) * this.viewHeight,
    );
  }
}
