// Collider — describes the collision shape attached to an entity
import { Component } from '../ecs/Component';
import { Vec2 } from '../math/Vec2';

export type ColliderShape = 'aabb' | 'circle' | 'polygon';

export interface AABB {
  halfW: number;
  halfH: number;
}

export interface CircleShape {
  radius: number;
}

export interface PolygonShape {
  vertices: Vec2[];  // local space, convex, CCW
}

export class Collider extends Component {
  static readonly TYPE = 'Collider';

  shape: ColliderShape = 'aabb';
  aabb?:    AABB;
  circle?:  CircleShape;
  polygon?: PolygonShape;

  // Offset from entity transform origin
  offsetX = 0;
  offsetY = 0;

  // Collision layers / masks (bitmask)
  layer    = 0x0001;
  mask     = 0xFFFF;  // which layers this collider collides with

  isTrigger   = false;  // true = no physical response, only events
  isSensor    = false;  // alias for trigger

  // Cached world-space AABB for broad phase (updated each physics step)
  worldMinX = 0; worldMinY = 0;
  worldMaxX = 0; worldMaxY = 0;

  static makeAABB(hw: number, hh: number, ox = 0, oy = 0): Collider {
    const c = new Collider();
    c.shape  = 'aabb';
    c.aabb   = { halfW: hw, halfH: hh };
    c.offsetX = ox; c.offsetY = oy;
    return c;
  }

  static makeCircle(radius: number, ox = 0, oy = 0): Collider {
    const c = new Collider();
    c.shape  = 'circle';
    c.circle = { radius };
    c.offsetX = ox; c.offsetY = oy;
    return c;
  }

  updateWorldBounds(px: number, py: number): void {
    const wx = px + this.offsetX;
    const wy = py + this.offsetY;
    if (this.shape === 'aabb' && this.aabb) {
      this.worldMinX = wx - this.aabb.halfW;
      this.worldMinY = wy - this.aabb.halfH;
      this.worldMaxX = wx + this.aabb.halfW;
      this.worldMaxY = wy + this.aabb.halfH;
    } else if (this.shape === 'circle' && this.circle) {
      const r = this.circle.radius;
      this.worldMinX = wx - r; this.worldMinY = wy - r;
      this.worldMaxX = wx + r; this.worldMaxY = wy + r;
    }
  }

  get width()  { return this.aabb ? this.aabb.halfW * 2 : (this.circle?.radius ?? 0) * 2; }
  get height() { return this.aabb ? this.aabb.halfH * 2 : (this.circle?.radius ?? 0) * 2; }
}
