// FrustumCuller — AABB-based viewport culling (Godot VisibilityNotifier equivalent)
// Eliminates draw calls for off-screen entities — typically cuts render cost 60-80%
import { Camera } from './Camera';

export interface CullBounds {
  minX: number; minY: number;
  maxX: number; maxY: number;
}

export class FrustumCuller {
  // Frustum in world space (updated each frame from camera)
  private left   = 0;
  private right  = 0;
  private bottom = 0;
  private top    = 0;

  // Margin added around viewport to prevent pop-in for large sprites
  marginX = 64;
  marginY = 64;

  // Statistics
  totalTested  = 0;
  totalCulled  = 0;
  get cullRate(): number { return this.totalTested > 0 ? this.totalCulled / this.totalTested : 0; }

  updateFromCamera(camera: Camera): void {
    const hw = (camera.viewWidth  / 2) / camera.zoom;
    const hh = (camera.viewHeight / 2) / camera.zoom;
    this.left   = camera.position.x - hw - this.marginX;
    this.right  = camera.position.x + hw + this.marginX;
    this.bottom = camera.position.y - hh - this.marginY;
    this.top    = camera.position.y + hh + this.marginY;
    this.totalTested = 0;
    this.totalCulled = 0;
  }

  /** Returns true if the bounds ARE visible (should be rendered) */
  isVisible(b: CullBounds): boolean {
    this.totalTested++;
    const visible = !(
      b.maxX < this.left  ||
      b.minX > this.right ||
      b.maxY < this.bottom ||
      b.minY > this.top
    );
    if (!visible) this.totalCulled++;
    return visible;
  }

  /** Quick check using a centre point + half-extents */
  isVisibleCircle(cx: number, cy: number, radius: number): boolean {
    return this.isVisible({
      minX: cx - radius, minY: cy - radius,
      maxX: cx + radius, maxY: cy + radius,
    });
  }

  isVisibleSprite(x: number, y: number, hw: number, hh: number): boolean {
    return this.isVisible({
      minX: x - hw, minY: y - hh,
      maxX: x + hw, maxY: y + hh,
    });
  }
}
