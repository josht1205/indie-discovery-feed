// ParticleEmitterSystem — drives all ParticleEmitter components
import { System }          from '../ecs/System';
import { ParticleEmitter } from './ParticleEmitter';
import { ParticleSystem }  from './ParticleSystem';
import { Transform }       from '../math/Transform';
import { Renderer }        from '../rendering/Renderer';

export class ParticleEmitterSystem extends System {
  priority = 8;
  private renderer: Renderer;

  constructor(renderer: Renderer) {
    super();
    this.renderer = renderer;
  }

  override update(dt: number): void {
    const entities = this.world.query(ParticleEmitter, Transform);
    for (const e of entities) {
      const emitter = e.requireComponent(ParticleEmitter);
      const tf      = e.requireComponent(Transform);

      // Lazy-init the GPU particle system
      if (!emitter.system) {
        emitter.system = new ParticleSystem(this.renderer.gl, emitter.params);
        emitter.system.texture = this.renderer.createSolidTexture(255, 255, 255);
      }

      emitter.system.x = tf.position.x;
      emitter.system.y = tf.position.y;

      if (emitter.playing) {
        emitter.system.update(dt);
      }
    }
  }

  /** Called after main sprite rendering to draw particles (correct blend order) */
  drawAll(projMatrix: Float32Array, viewMatrix: Float32Array): void {
    if (!this.world) return;
    const entities = this.world.query(ParticleEmitter);
    for (const e of entities) {
      const emitter = e.requireComponent(ParticleEmitter);
      emitter.system?.draw(projMatrix, viewMatrix);
    }
  }

  override destroy(): void {
    const entities = this.world.query(ParticleEmitter);
    for (const e of entities) {
      e.getComponent(ParticleEmitter)?.system?.destroy();
    }
  }
}
