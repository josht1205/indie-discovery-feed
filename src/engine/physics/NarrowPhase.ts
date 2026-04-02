// NarrowPhase — precise collision detection using SAT, AABB, and Circle tests
// Returns a CollisionManifold if collision occurred
import { Collider } from './Collider';
import { Vec2 } from '../math/Vec2';
import { Transform } from '../math/Transform';

export interface CollisionManifold {
  normal:        Vec2;     // points from b → a (push direction for a)
  penetration:   number;   // overlap depth
  contactPoint:  Vec2;     // world-space contact point
  contactCount:  number;
}

export class NarrowPhase {
  /** Dispatch to the right test based on shape pair */
  static test(
    aCol: Collider, aPos: Vec2,
    bCol: Collider, bPos: Vec2,
  ): CollisionManifold | null {
    const wa = aPos.add(new Vec2(aCol.offsetX, aCol.offsetY));
    const wb = bPos.add(new Vec2(bCol.offsetX, bCol.offsetY));

    if (aCol.shape === 'aabb' && bCol.shape === 'aabb') {
      return this.aabbVsAabb(aCol, wa, bCol, wb);
    }
    if (aCol.shape === 'circle' && bCol.shape === 'circle') {
      return this.circleVsCircle(aCol, wa, bCol, wb);
    }
    if (aCol.shape === 'aabb' && bCol.shape === 'circle') {
      return this.aabbVsCircle(aCol, wa, bCol, wb);
    }
    if (aCol.shape === 'circle' && bCol.shape === 'aabb') {
      const m = this.aabbVsCircle(bCol, wb, aCol, wa);
      if (m) m.normal = m.normal.negate();
      return m;
    }
    return null;
  }

  private static aabbVsAabb(
    a: Collider, wa: Vec2,
    b: Collider, wb: Vec2,
  ): CollisionManifold | null {
    const dx = wb.x - wa.x, dy = wb.y - wa.y;
    const overlapX = (a.aabb!.halfW + b.aabb!.halfW) - Math.abs(dx);
    if (overlapX <= 0) return null;
    const overlapY = (a.aabb!.halfH + b.aabb!.halfH) - Math.abs(dy);
    if (overlapY <= 0) return null;

    let nx: number, ny: number, pen: number;
    if (overlapX < overlapY) {
      nx  = dx < 0 ? 1 : -1; ny = 0;
      pen = overlapX;
    } else {
      nx  = 0; ny = dy < 0 ? 1 : -1;
      pen = overlapY;
    }
    return {
      normal:       new Vec2(nx, ny),
      penetration:  pen,
      contactPoint: new Vec2(wa.x + nx * a.aabb!.halfW, wa.y + ny * a.aabb!.halfH),
      contactCount: 1,
    };
  }

  private static circleVsCircle(
    a: Collider, wa: Vec2,
    b: Collider, wb: Vec2,
  ): CollisionManifold | null {
    const diff = wb.sub(wa);
    const dist = diff.length();
    const radSum = a.circle!.radius + b.circle!.radius;
    if (dist >= radSum) return null;

    const pen  = radSum - dist;
    const norm = dist > 1e-6 ? diff.normalize() : new Vec2(1, 0);
    return {
      normal:       norm.negate(),
      penetration:  pen,
      contactPoint: wa.add(norm.mul(a.circle!.radius)),
      contactCount: 1,
    };
  }

  private static aabbVsCircle(
    box: Collider, wb: Vec2,
    circ: Collider, wc: Vec2,
  ): CollisionManifold | null {
    const closest = new Vec2(
      Math.max(wb.x - box.aabb!.halfW, Math.min(wc.x, wb.x + box.aabb!.halfW)),
      Math.max(wb.y - box.aabb!.halfH, Math.min(wc.y, wb.y + box.aabb!.halfH)),
    );
    const diff = wc.sub(closest);
    const dist = diff.length();
    const r    = circ.circle!.radius;
    if (dist >= r) return null;

    const pen  = r - dist;
    const norm = dist > 1e-6 ? diff.normalize() : new Vec2(0, -1);
    return {
      normal:       norm.negate(),
      penetration:  pen,
      contactPoint: closest,
      contactCount: 1,
    };
  }
}
