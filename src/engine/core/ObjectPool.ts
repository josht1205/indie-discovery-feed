// ObjectPool — generic arena-style memory pool (Godot + UE5 pooling strategy)
// Eliminates GC pressure for frequently-created/destroyed objects (bullets, FX, etc.)
// O(1) acquire and release.
import { createLogger } from './Logger';

const log = createLogger('ObjectPool');

export interface Poolable {
  reset(): void;     // Called before re-use — must clear all state
}

export class ObjectPool<T extends Poolable> {
  private pool:      T[]    = [];
  private inUse:     Set<T> = new Set();
  private factory:   () => T;
  private maxSize:   number;

  readonly name: string;

  // Diagnostics
  get totalSize():  number { return this.pool.length + this.inUse.size; }
  get activeCount():number { return this.inUse.size; }
  get freeCount():  number { return this.pool.length; }

  constructor(name: string, factory: () => T, initialSize = 32, maxSize = 1024) {
    this.name    = name;
    this.factory = factory;
    this.maxSize = maxSize;

    // Pre-warm
    for (let i = 0; i < initialSize; i++) this.pool.push(factory());
    log.debug('Pool "%s" pre-warmed with %d objects', name, initialSize);
  }

  /** Acquire an object from the pool (or allocate if empty) */
  acquire(): T {
    let obj: T;
    if (this.pool.length > 0) {
      obj = this.pool.pop()!;
    } else if (this.totalSize < this.maxSize) {
      obj = this.factory();
      log.debug('Pool "%s" expanded (size=%d)', this.name, this.totalSize + 1);
    } else {
      log.warn('Pool "%s" exhausted (max=%d)', this.name, this.maxSize);
      // Reclaim oldest in-use object as fallback
      obj = this.inUse.values().next().value!;
      this.inUse.delete(obj);
      obj.reset();
    }
    this.inUse.add(obj);
    return obj;
  }

  /** Return an object to the pool */
  release(obj: T): void {
    if (!this.inUse.has(obj)) return;
    this.inUse.delete(obj);
    obj.reset();
    this.pool.push(obj);
  }

  /** Release all active objects */
  releaseAll(): void {
    for (const obj of this.inUse) {
      obj.reset();
      this.pool.push(obj);
    }
    this.inUse.clear();
  }

  /** Iterate over all currently active objects */
  forEachActive(fn: (obj: T) => void): void {
    this.inUse.forEach(fn);
  }
}

// ── PoolManager — global registry of named pools (UE5 style) ────────────────

class PoolManagerImpl {
  private pools = new Map<string, ObjectPool<Poolable>>();

  register<T extends Poolable>(pool: ObjectPool<T>): void {
    this.pools.set(pool.name, pool as ObjectPool<Poolable>);
  }

  get<T extends Poolable>(name: string): ObjectPool<T> | undefined {
    return this.pools.get(name) as ObjectPool<T> | undefined;
  }

  releaseAll(): void {
    this.pools.forEach(p => p.releaseAll());
  }

  getStats(): Record<string, { active: number; free: number; total: number }> {
    const stats: Record<string, { active: number; free: number; total: number }> = {};
    this.pools.forEach((p, name) => {
      stats[name] = { active: p.activeCount, free: p.freeCount, total: p.totalSize };
    });
    return stats;
  }
}

export const PoolManager = new PoolManagerImpl();
