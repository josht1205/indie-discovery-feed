// CCD — Continuous Collision Detection for fast-moving objects (UE5 Chaos Physics)
// Uses Swept AABB / swept circle to prevent tunnelling through thin objects
import { Vec2 }     from '../math/Vec2';
import { Collider } from './Collider';

export interface SweepResult {
  hit:         boolean;
  toi:         number;    // Time Of Impact [0..1]  — 0=start, 1=end
  normal:      Vec2;
  contactPoint: Vec2;
}

export class CCD {
  /**
   * Sweep an AABB from posA to posA+delta against a static AABB.
   * Returns the fraction of movement before impact (TOI).
   */
  static sweepAABBvsAABB(
    movHW: number, movHH: number,
    posA: Vec2, delta: Vec2,
    staticX: number, staticY: number, staticHW: number, staticHH: number,
  ): SweepResult {
    // Minkowski sum: expand static by mover's half-extents
    const mhw = movHW + staticHW;
    const mhh = movHH + staticHH;

    const invDx = delta.x !== 0 ? 1 / delta.x : Infinity;
    const invDy = delta.y !== 0 ? 1 / delta.y : Infinity;

    const t1 = (staticX - mhw - posA.x) * invDx;
    const t2 = (staticX + mhw - posA.x) * invDx;
    const t3 = (staticY - mhh - posA.y) * invDy;
    const t4 = (staticY + mhh - posA.y) * invDy;

    const tMin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
    const tMax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

    if (tMax < 0 || tMin > tMax || tMin > 1 || tMin < 0) {
      return { hit: false, toi: 1, normal: Vec2.zero(), contactPoint: Vec2.zero() };
    }

    let normal: Vec2;
    if (Math.min(t1, t2) > Math.min(t3, t4)) {
      normal = new Vec2(delta.x > 0 ? -1 : 1, 0);
    } else {
      normal = new Vec2(0, delta.y > 0 ? -1 : 1);
    }

    const contactPoint = posA.add(delta.mul(tMin));
    return { hit: true, toi: tMin, normal, contactPoint };
  }

  /**
   * Sweep a circle against an AABB.
   */
  static sweepCircleVsAABB(
    radius: number,
    posA: Vec2, delta: Vec2,
    staticX: number, staticY: number, staticHW: number, staticHH: number,
  ): SweepResult {
    // Expand AABB by radius and do a ray cast
    const expandedHW = staticHW + radius;
    const expandedHH = staticHH + radius;

    return CCD.sweepAABBvsAABB(
      0, 0,                           // point mover (after circle expansion)
      posA, delta,
      staticX, staticY,
      expandedHW, expandedHH,
    );
  }

  /**
   * Given a RigidBody moving at high speed, compute the sub-step count needed
   * to prevent tunnelling. Returns 1 for slow objects (no overhead).
   */
  static requiredSubsteps(speed: number, colliderSize: number, dt: number): number {
    const displacement = speed * dt;
    if (displacement < colliderSize * 0.5) return 1;
    return Math.min(Math.ceil(displacement / (colliderSize * 0.5)), 8);
  }
}
