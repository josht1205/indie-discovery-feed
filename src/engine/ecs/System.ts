// System — base class for all logic processors
// Systems query the World for entities that have specific component sets
import { World } from './World';

export abstract class System {
  /** Override to declare required component types for the default query */
  static readonly REQUIRED_COMPONENTS: string[] = [];

  enabled  = true;
  priority = 0;  // lower priority runs first
  protected world!: World;

  // Called once when the system is registered with the World
  init(world: World): void {
    this.world = world;
  }

  // Called once per fixed timestep (deterministic physics / logic)
  fixedUpdate?(dt: number): void;

  // Called once per frame (variable rate: rendering support, UI, etc.)
  update?(dt: number): void;

  // Called once per frame after update — good for late transform sync
  lateUpdate?(dt: number): void;

  // Called when this system is removed from the World
  destroy?(): void;
}
