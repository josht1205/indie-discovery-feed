// World — the ECS "universe" that owns entities and systems
import { Entity } from './Entity';
import { System } from './System';
import { Component, ComponentClass } from './Component';
import { EventEmitter } from '../core/EventEmitter';
import { createLogger } from '../core/Logger';

const log = createLogger('World');

export class World {
  readonly events = new EventEmitter();
  private entities  = new Map<number, Entity>();
  private systems:  System[] = [];
  private toDestroy: number[] = [];

  // --- Entity management ---

  createEntity(name = 'Entity'): Entity {
    const e = new Entity(name);
    this.entities.set(e.id, e);
    this.events.emit('entity:created', e);
    return e;
  }

  destroyEntity(id: number): void {
    this.toDestroy.push(id);
  }

  getEntity(id: number): Entity | undefined {
    return this.entities.get(id);
  }

  getAllEntities(): Entity[] {
    return [...this.entities.values()];
  }

  // --- Component queries ---

  /** Returns all active entities that have ALL listed component types */
  query<T extends Component[]>(...classes: { [K in keyof T]: ComponentClass<T[K]> }): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities.values()) {
      if (!entity.active) continue;
      let match = true;
      for (const cls of classes) {
        if (!entity.hasComponent(cls)) { match = false; break; }
      }
      if (match) result.push(entity);
    }
    return result;
  }

  /** Returns the first entity with the given component, or undefined */
  queryFirst<T extends Component>(cls: ComponentClass<T>): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.active && entity.hasComponent(cls)) return entity;
    }
    return undefined;
  }

  /** Find entity by name */
  findByName(name: string): Entity | undefined {
    for (const entity of this.entities.values()) {
      if (entity.name === name) return entity;
    }
    return undefined;
  }

  // --- System management ---

  addSystem<T extends System>(system: T): T {
    system.init(this);
    this.systems.push(system);
    this.systems.sort((a, b) => a.priority - b.priority);
    log.debug('System added: %s (priority %d)', system.constructor.name, system.priority);
    return system;
  }

  removeSystem(system: System): void {
    const idx = this.systems.indexOf(system);
    if (idx !== -1) {
      system.destroy?.();
      this.systems.splice(idx, 1);
    }
  }

  // --- Update loop hooks ---

  fixedUpdate(dt: number): void {
    this._flushDestroys();
    for (const s of this.systems) {
      if (s.enabled) s.fixedUpdate?.(dt);
    }
  }

  update(dt: number): void {
    for (const s of this.systems) {
      if (s.enabled) s.update?.(dt);
    }
  }

  lateUpdate(dt: number): void {
    for (const s of this.systems) {
      if (s.enabled) s.lateUpdate?.(dt);
    }
  }

  // --- Internal ---

  private _flushDestroys(): void {
    for (const id of this.toDestroy) {
      const e = this.entities.get(id);
      if (e) {
        e.destroy();
        this.entities.delete(id);
        this.events.emit('entity:destroyed', id);
      }
    }
    this.toDestroy.length = 0;
  }

  /** Wipe all entities and systems */
  clear(): void {
    this.entities.forEach((e) => e.destroy());
    this.entities.clear();
    this.systems.forEach((s) => s.destroy?.());
    this.systems.length = 0;
  }
}
