// Groups — Godot-style entity group/tag system for batch operations
// Enables: "get all enemies", "pause all projectiles", "remove all vfx"
// O(1) membership test, O(k) iteration where k = group size
import { Entity } from './Entity';
import { createLogger } from '../core/Logger';

const log = createLogger('Groups');

export class GroupManager {
  private groups = new Map<string, Set<number>>();       // groupName → entity ids
  private entityGroups = new Map<number, Set<string>>(); // entityId → groups

  addToGroup(entity: Entity, group: string): void {
    if (!this.groups.has(group)) this.groups.set(group, new Set());
    this.groups.get(group)!.add(entity.id);

    if (!this.entityGroups.has(entity.id)) this.entityGroups.set(entity.id, new Set());
    this.entityGroups.get(entity.id)!.add(group);
  }

  removeFromGroup(entity: Entity, group: string): void {
    this.groups.get(group)?.delete(entity.id);
    this.entityGroups.get(entity.id)?.delete(group);
  }

  isInGroup(entity: Entity, group: string): boolean {
    return this.groups.get(group)?.has(entity.id) ?? false;
  }

  getGroup(group: string): number[] {
    return [...(this.groups.get(group) ?? [])];
  }

  getGroupCount(group: string): number {
    return this.groups.get(group)?.size ?? 0;
  }

  getEntityGroups(entity: Entity): string[] {
    return [...(this.entityGroups.get(entity.id) ?? [])];
  }

  removeEntity(entityId: number): void {
    const groups = this.entityGroups.get(entityId);
    if (groups) {
      for (const g of groups) this.groups.get(g)?.delete(entityId);
      this.entityGroups.delete(entityId);
    }
  }

  clearGroup(group: string): void {
    const ids = this.groups.get(group);
    if (ids) {
      for (const id of ids) this.entityGroups.get(id)?.delete(group);
      this.groups.get(group)!.clear();
    }
  }

  clear(): void {
    this.groups.clear();
    this.entityGroups.clear();
  }
}

// Tag component — lightweight marker components using string tags
export class Tags {
  private tags = new Set<string>();

  add(...tags: string[]): this { tags.forEach(t => this.tags.add(t)); return this; }
  remove(tag: string): this    { this.tags.delete(tag); return this; }
  has(tag: string): boolean    { return this.tags.has(tag); }
  hasAll(...tags: string[]): boolean { return tags.every(t => this.tags.has(t)); }
  hasAny(...tags: string[]): boolean { return tags.some(t => this.tags.has(t)); }
  getAll(): string[]           { return [...this.tags]; }
  clear(): void                { this.tags.clear(); }
}
