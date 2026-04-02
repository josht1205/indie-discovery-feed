// CollisionResolver — impulse-based collision response with friction
import { CollisionManifold } from './NarrowPhase';
import { RigidBody } from './RigidBody';
import { Vec2 } from '../math/Vec2';

const SLOP       = 0.01;  // penetration allowance
const PERCENT    = 0.4;   // positional correction factor
const ITERATIONS = 8;     // velocity iterations per step

export interface BodyPair {
  aBody:   RigidBody;
  bBody:   RigidBody;
  aTfPos:  { x: number; y: number };
  bTfPos:  { x: number; y: number };
  manifold: CollisionManifold;
}

export class CollisionResolver {
  /** Apply impulse-based velocity correction */
  static resolve(pair: BodyPair): void {
    const { aBody, bBody, manifold } = pair;

    const { normal, penetration, contactPoint } = manifold;

    // Relative velocity at contact
    const rv = bBody.velocity.sub(aBody.velocity);
    const velAlongNormal = rv.dot(normal);

    // Already separating
    if (velAlongNormal > 0) return;

    const e   = Math.min(aBody.restitution, bBody.restitution);
    const iMass = aBody.invMass + bBody.invMass;
    if (iMass < 1e-10) return;

    // Impulse scalar
    const j = -(1 + e) * velAlongNormal / iMass;
    const impulse = normal.mul(j);

    aBody.applyImpulse(-impulse.x, -impulse.y);
    bBody.applyImpulse( impulse.x,  impulse.y);

    // Friction impulse
    const tangent = rv.sub(normal.mul(rv.dot(normal))).normalize();
    const jt = -rv.dot(tangent) / iMass;
    const mu = (aBody.friction + bBody.friction) * 0.5;

    const frictionImpulse = Math.abs(jt) < j * mu
      ? tangent.mul(jt)
      : tangent.mul(-j * mu);

    aBody.applyImpulse(-frictionImpulse.x, -frictionImpulse.y);
    bBody.applyImpulse( frictionImpulse.x,  frictionImpulse.y);
  }

  /** Positional correction to prevent sinking (Baumgarte stabilisation) */
  static correctPosition(pair: BodyPair): void {
    const { aBody, bBody, aTfPos, bTfPos, manifold } = pair;
    const { penetration, normal } = manifold;

    const iMass = aBody.invMass + bBody.invMass;
    if (iMass < 1e-10) return;

    const correction = Math.max(penetration - SLOP, 0) / iMass * PERCENT;
    const corr = normal.mul(correction);

    if (!aBody.isStatic && !aBody.freezeX) aTfPos.x -= corr.x * aBody.invMass;
    if (!aBody.isStatic && !aBody.freezeY) aTfPos.y -= corr.y * aBody.invMass;
    if (!bBody.isStatic && !bBody.freezeX) bTfPos.x += corr.x * bBody.invMass;
    if (!bBody.isStatic && !bBody.freezeY) bTfPos.y += corr.y * bBody.invMass;
  }
}
