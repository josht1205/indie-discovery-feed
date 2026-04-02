// BroadPhase — spatial hash grid for efficient collision candidate detection
// O(n) average case using uniform grid cells
import { Entity } from '../ecs/Entity';
import { Collider } from './Collider';
import { Transform } from '../math/Transform';

export type CollisionPair = [Entity, Entity];

export class SpatialHashGrid {
  private cellSize: number;
  private cells: Map<number, Entity[]> = new Map();

  constructor(cellSize = 64) {
    this.cellSize = cellSize;
  }

  private hash(cx: number, cy: number): number {
    // Cantor pairing — good enough for moderate grid sizes
    return ((cx + cy) * (cx + cy + 1)) / 2 + cy;
  }

  private cellCoord(v: number): number {
    return Math.floor(v / this.cellSize);
  }

  clear(): void { this.cells.clear(); }

  insert(entity: Entity, collider: Collider): void {
    const minCX = this.cellCoord(collider.worldMinX);
    const minCY = this.cellCoord(collider.worldMinY);
    const maxCX = this.cellCoord(collider.worldMaxX);
    const maxCY = this.cellCoord(collider.worldMaxY);

    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        const key = this.hash(cx, cy);
        if (!this.cells.has(key)) this.cells.set(key, []);
        this.cells.get(key)!.push(entity);
      }
    }
  }

  /** Returns unique candidate pairs that share at least one cell */
  getCandidatePairs(): CollisionPair[] {
    const pairs: CollisionPair[] = [];
    const seen = new Set<number>();

    for (const cell of this.cells.values()) {
      for (let i = 0; i < cell.length; i++) {
        for (let j = i + 1; j < cell.length; j++) {
          const a = cell[i], b = cell[j];
          // Unique pair key (order-independent)
          const minId = Math.min(a.id, b.id);
          const maxId = Math.max(a.id, b.id);
          const key   = minId * 100000 + maxId;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push([a, b]);
          }
        }
      }
    }
    return pairs;
  }

  /** Simple AABB overlap test for early-out */
  static aabbOverlap(a: Collider, b: Collider): boolean {
    return !(
      a.worldMaxX < b.worldMinX ||
      a.worldMinX > b.worldMaxX ||
      a.worldMaxY < b.worldMinY ||
      a.worldMinY > b.worldMaxY
    );
  }
}
