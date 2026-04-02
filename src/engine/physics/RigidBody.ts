// RigidBody — physics body component (velocity, mass, constraints)
import { Component } from '../ecs/Component';
import { Vec2 } from '../math/Vec2';

export type BodyType = 'dynamic' | 'kinematic' | 'static';

export class RigidBody extends Component {
  static readonly TYPE = 'RigidBody';

  bodyType:   BodyType = 'dynamic';
  mass:       number   = 1;
  invMass:    number   = 1;     // 0 for static/kinematic
  restitution:number   = 0.3;  // bounciness [0,1]
  friction:   number   = 0.4;

  velocity:     Vec2  = new Vec2();
  angularVel:   number = 0;
  force:        Vec2  = new Vec2();
  torque:       number = 0;

  // Inertia moment (computed from collider shape)
  inertia:    number = 1;
  invInertia: number = 1;

  // Gravity scale (0 = ignore gravity)
  gravityScale = 1;

  // Lock axes
  freezeX        = false;
  freezeY        = false;
  freezeRotation = false;

  // Linear/angular damping [0,1]
  linearDamping  = 0.02;
  angularDamping = 0.05;

  setMass(m: number): void {
    this.mass    = m;
    this.invMass = m > 0 ? 1 / m : 0;
    this.inertia    = m * 0.5; // default; override with collider shape
    this.invInertia = this.inertia > 0 ? 1 / this.inertia : 0;
  }

  applyForce(fx: number, fy: number): void {
    if (this.bodyType !== 'dynamic') return;
    this.force.x += fx;
    this.force.y += fy;
  }

  applyImpulse(ix: number, iy: number): void {
    if (this.bodyType !== 'dynamic') return;
    this.velocity.x += ix * this.invMass;
    this.velocity.y += iy * this.invMass;
  }

  applyImpulseAtPoint(ix: number, iy: number, rx: number, ry: number): void {
    if (this.bodyType !== 'dynamic') return;
    this.velocity.x += ix * this.invMass;
    this.velocity.y += iy * this.invMass;
    this.angularVel += (rx * iy - ry * ix) * this.invInertia;
  }

  clearForces(): void {
    this.force.set(0, 0);
    this.torque = 0;
  }

  get isStatic() { return this.bodyType === 'static'; }
}
