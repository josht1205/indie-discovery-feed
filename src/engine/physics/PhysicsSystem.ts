// PhysicsSystem — integrates velocities, runs collision detection & resolution
import { System } from '../ecs/System';
import { World } from '../ecs/World';
import { Entity } from '../ecs/Entity';
import { RigidBody } from './RigidBody';
import { Collider } from './Collider';
import { Transform } from '../math/Transform';
import { SpatialHashGrid } from './BroadPhase';
import { NarrowPhase } from './NarrowPhase';
import { CollisionResolver } from './CollisionResolver';
import { Vec2 } from '../math/Vec2';
import { createLogger } from '../core/Logger';

const log = createLogger('PhysicsSystem');

export interface PhysicsConfig {
  gravity:         Vec2;
  velocityIterations: number;
  positionIterations: number;
  cellSize:        number;
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity:             new Vec2(0, -980),  // pixels/s² (downward)
  velocityIterations:  8,
  positionIterations:  3,
  cellSize:            128,
};

export interface CollisionEvent {
  a: Entity;
  b: Entity;
  manifold: ReturnType<typeof NarrowPhase.test>;
}

export class PhysicsSystem extends System {
  priority = 10;

  private grid: SpatialHashGrid;
  private config: PhysicsConfig;

  constructor(config: Partial<PhysicsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config };
    this.grid   = new SpatialHashGrid(this.config.cellSize);
  }

  override fixedUpdate(dt: number): void {
    const entities = this.world.query(Transform, RigidBody);

    // 1. Save previous positions for interpolation
    for (const e of entities) {
      e.requireComponent(Transform).savePrev();
    }

    // 2. Integrate forces → velocities → positions
    for (const e of entities) {
      const body = e.requireComponent(RigidBody);
      const tf   = e.requireComponent(Transform);

      if (body.bodyType !== 'dynamic') continue;

      // Apply gravity
      body.applyForce(
        this.config.gravity.x * body.mass * body.gravityScale,
        this.config.gravity.y * body.mass * body.gravityScale,
      );

      // Symplectic Euler integration
      body.velocity.x += body.force.x * body.invMass * dt;
      body.velocity.y += body.force.y * body.invMass * dt;

      // Damping
      const linearFactor  = Math.max(0, 1 - body.linearDamping  * dt);
      const angularFactor = Math.max(0, 1 - body.angularDamping * dt);
      body.velocity.mulEq(linearFactor);
      body.angularVel *= angularFactor;

      if (!body.freezeX) tf.position.x += body.velocity.x * dt;
      if (!body.freezeY) tf.position.y += body.velocity.y * dt;
      if (!body.freezeRotation) tf.rotation += body.angularVel * dt;

      body.clearForces();
    }

    // 3. Broad-phase: build spatial hash
    this.grid.clear();
    const collidables = this.world.query(Transform, Collider);
    for (const e of collidables) {
      const col = e.requireComponent(Collider);
      const tf  = e.requireComponent(Transform);
      col.updateWorldBounds(tf.position.x, tf.position.y);
      this.grid.insert(e, col);
    }

    // 4. Narrow-phase + resolution
    const pairs = this.grid.getCandidatePairs();
    for (const [ea, eb] of pairs) {
      const colA = ea.getComponent(Collider)!;
      const colB = eb.getComponent(Collider)!;

      // Layer mask check
      if (!(colA.layer & colB.mask) && !(colB.layer & colA.mask)) continue;

      const tfA = ea.getComponent(Transform)!;
      const tfB = eb.getComponent(Transform)!;

      const manifold = NarrowPhase.test(
        colA, tfA.position,
        colB, tfB.position,
      );

      if (!manifold) continue;

      // Fire collision event
      this.world.events.emit<CollisionEvent>('collision', { a: ea, b: eb, manifold });

      // If trigger, skip resolution
      if (colA.isTrigger || colB.isTrigger) continue;

      const bodyA = ea.getComponent(RigidBody);
      const bodyB = eb.getComponent(RigidBody);
      if (!bodyA || !bodyB) continue;

      // Velocity resolution
      for (let i = 0; i < this.config.velocityIterations; i++) {
        CollisionResolver.resolve({
          aBody: bodyA, bBody: bodyB,
          aTfPos: tfA.position,
          bTfPos: tfB.position,
          manifold,
        });
      }

      // Position correction
      for (let i = 0; i < this.config.positionIterations; i++) {
        CollisionResolver.correctPosition({
          aBody: bodyA, bBody: bodyB,
          aTfPos: tfA.position,
          bTfPos: tfB.position,
          manifold,
        });
      }
    }
  }
}
