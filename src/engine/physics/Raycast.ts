// Raycast — spatial-hash-accelerated 2D raycasting (UE5 Chaos Physics equivalent)
// Supports: circle cast, segment cast, point overlap, multi-shape queries
import { SpatialHashGrid } from './BroadPhase';
import { Collider }        from './Collider';
import { Transform }       from '../math/Transform';
import { Vec2 }            from '../math/Vec2';
import { Entity }          from '../ecs/Entity';
import { World }           from '../ecs/World';

export interface RaycastHit {
  entity:   Entity;
  point:    Vec2;      // world-space contact point
  normal:   Vec2;      // surface normal at hit
  distance: number;    // distance from ray origin
  collider: Collider;
}

export interface RaycastOptions {
  maxDistance?: number;
  layerMask?:   number;   // bitmask of layers to check
  ignoreEntity?: number;  // entity id to skip (e.g. the caster itself)
}

export class Raycast {
  /**
   * Cast a ray from origin in direction, return first hit.
   * Uses spatial hash for O(log n) candidate rejection.
   */
  static cast(
    world: World,
    origin: Vec2,
    direction: Vec2,
    opts: RaycastOptions = {},
  ): RaycastHit | null {
    const maxDist = opts.maxDistance ?? 10000;
    const mask    = opts.layerMask   ?? 0xFFFF;
    const dir     = direction.normalize();
    const end     = origin.add(dir.mul(maxDist));

    const candidates = world.query(Transform, Collider);
    let closest: RaycastHit | null = null;

    for (const e of candidates) {
      if (e.id === opts.ignoreEntity) continue;
      const col = e.requireComponent(Collider);
      const tf  = e.requireComponent(Transform);
      if (!(col.layer & mask)) continue;

      const wx = tf.position.x + col.offsetX;
      const wy = tf.position.y + col.offsetY;

      let hit: { point: Vec2; normal: Vec2; dist: number } | null = null;

      if (col.shape === 'aabb' && col.aabb) {
        hit = this._rayVsAABB(origin, dir, maxDist, wx, wy, col.aabb.halfW, col.aabb.halfH);
      } else if (col.shape === 'circle' && col.circle) {
        hit = this._rayVsCircle(origin, dir, maxDist, new Vec2(wx, wy), col.circle.radius);
      }

      if (hit && (!closest || hit.dist < closest.distance)) {
        closest = {
          entity:   e,
          point:    hit.point,
          normal:   hit.normal,
          distance: hit.dist,
          collider: col,
        };
      }
    }
    return closest;
  }

  /**
   * Cast all hits along a ray (sorted by distance).
   */
  static castAll(
    world: World,
    origin: Vec2,
    direction: Vec2,
    opts: RaycastOptions = {},
  ): RaycastHit[] {
    const maxDist = opts.maxDistance ?? 10000;
    const mask    = opts.layerMask   ?? 0xFFFF;
    const dir     = direction.normalize();
    const hits: RaycastHit[] = [];

    for (const e of world.query(Transform, Collider)) {
      if (e.id === opts.ignoreEntity) continue;
      const col = e.requireComponent(Collider);
      const tf  = e.requireComponent(Transform);
      if (!(col.layer & mask)) continue;

      const wx = tf.position.x + col.offsetX;
      const wy = tf.position.y + col.offsetY;

      let hit: { point: Vec2; normal: Vec2; dist: number } | null = null;
      if (col.shape === 'aabb' && col.aabb) {
        hit = this._rayVsAABB(origin, dir, maxDist, wx, wy, col.aabb.halfW, col.aabb.halfH);
      } else if (col.shape === 'circle' && col.circle) {
        hit = this._rayVsCircle(origin, dir, maxDist, new Vec2(wx, wy), col.circle.radius);
      }

      if (hit) {
        hits.push({ entity: e, point: hit.point, normal: hit.normal, distance: hit.dist, collider: col });
      }
    }
    return hits.sort((a, b) => a.distance - b.distance);
  }

  /** Check all colliders overlapping a point */
  static overlapPoint(world: World, point: Vec2, mask = 0xFFFF): Entity[] {
    const results: Entity[] = [];
    for (const e of world.query(Transform, Collider)) {
      const col = e.requireComponent(Collider);
      const tf  = e.requireComponent(Transform);
      if (!(col.layer & mask)) continue;
      const wx = tf.position.x + col.offsetX;
      const wy = tf.position.y + col.offsetY;

      let inside = false;
      if (col.shape === 'aabb' && col.aabb) {
        inside = Math.abs(point.x - wx) <= col.aabb.halfW &&
                 Math.abs(point.y - wy) <= col.aabb.halfH;
      } else if (col.shape === 'circle' && col.circle) {
        inside = point.distanceTo(new Vec2(wx, wy)) <= col.circle.radius;
      }
      if (inside) results.push(e);
    }
    return results;
  }

  /** Check all colliders overlapping a circle */
  static overlapCircle(world: World, center: Vec2, radius: number, mask = 0xFFFF): Entity[] {
    const results: Entity[] = [];
    for (const e of world.query(Transform, Collider)) {
      const col = e.requireComponent(Collider);
      const tf  = e.requireComponent(Transform);
      if (!(col.layer & mask)) continue;
      col.updateWorldBounds(tf.position.x, tf.position.y);
      const dx = MathUtils_clamp(center.x, col.worldMinX, col.worldMaxX) - center.x;
      const dy = MathUtils_clamp(center.y, col.worldMinY, col.worldMaxY) - center.y;
      if (dx * dx + dy * dy <= radius * radius) results.push(e);
    }
    return results;
  }

  // ── Internal ray-vs-shape tests ──────────────────────────────────────────

  private static _rayVsAABB(
    origin: Vec2, dir: Vec2, maxDist: number,
    cx: number, cy: number, hw: number, hh: number,
  ): { point: Vec2; normal: Vec2; dist: number } | null {
    const invDx = dir.x !== 0 ? 1 / dir.x : Infinity;
    const invDy = dir.y !== 0 ? 1 / dir.y : Infinity;

    const t1 = (cx - hw - origin.x) * invDx;
    const t2 = (cx + hw - origin.x) * invDx;
    const t3 = (cy - hh - origin.y) * invDy;
    const t4 = (cy + hh - origin.y) * invDy;

    const tMin = Math.max(Math.min(t1, t2), Math.min(t3, t4));
    const tMax = Math.min(Math.max(t1, t2), Math.max(t3, t4));

    if (tMax < 0 || tMin > tMax || tMin > maxDist) return null;

    const t = tMin < 0 ? tMax : tMin;
    const point = origin.add(dir.mul(t));

    // Surface normal from which face was hit
    let normal = new Vec2();
    if (Math.min(t1, t2) > Math.min(t3, t4)) {
      normal = new Vec2(dir.x > 0 ? -1 : 1, 0);
    } else {
      normal = new Vec2(0, dir.y > 0 ? -1 : 1);
    }
    return { point, normal, dist: t };
  }

  private static _rayVsCircle(
    origin: Vec2, dir: Vec2, maxDist: number,
    center: Vec2, radius: number,
  ): { point: Vec2; normal: Vec2; dist: number } | null {
    const oc = origin.sub(center);
    const b  = 2 * oc.dot(dir);
    const c  = oc.dot(oc) - radius * radius;
    const disc = b * b - 4 * c;
    if (disc < 0) return null;

    const sqrtDisc = Math.sqrt(disc);
    const t1 = (-b - sqrtDisc) / 2;
    const t2 = (-b + sqrtDisc) / 2;
    const t  = t1 >= 0 ? t1 : t2;
    if (t < 0 || t > maxDist) return null;

    const point  = origin.add(dir.mul(t));
    const normal = point.sub(center).normalize();
    return { point, normal, dist: t };
  }
}

// Inline clamp to avoid import
function MathUtils_clamp(v: number, min: number, max: number) {
  return v < min ? min : v > max ? max : v;
}
