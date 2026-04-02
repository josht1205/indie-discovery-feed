// AudioSystem — drives AudioSourceComponents and syncs 3D listener to camera/player
import { System }               from '../ecs/System';
import { AudioEngine }          from './AudioEngine';
import { AudioSourceComponent } from './AudioSourceComponent';
import { Transform }            from '../math/Transform';
import { Vec3 }                 from '../math/Vec3';
import { Camera }               from '../rendering/Camera';
import { createLogger }         from '../core/Logger';

const log = createLogger('AudioSystem');

export class AudioSystem extends System {
  priority = 100;

  readonly engine: AudioEngine;
  private buffers = new Map<string, AudioBuffer>();

  constructor() {
    super();
    this.engine = new AudioEngine();
  }

  /** Call once after user interaction to unlock Web Audio */
  async start(): Promise<void> {
    await this.engine.init();
  }

  override async update(dt: number): Promise<void> {
    // Update 3D listener from camera entity
    const camEntity = this.world.queryFirst(Camera);
    if (camEntity) {
      const cam = camEntity.requireComponent(Camera);
      const tf  = camEntity.getComponent(Transform);
      if (tf) {
        this.engine.setListenerTransform(
          new Vec3(tf.position.x, tf.position.y, 0),
          Vec3.forward(),
          Vec3.up(),
        );
      }
    }

    // Drive audio sources
    const sources = this.world.query(AudioSourceComponent, Transform);
    for (const e of sources) {
      const src = e.requireComponent(AudioSourceComponent);
      const tf  = e.requireComponent(Transform);

      if (!src.enabled) continue;

      // Lazy-load buffer
      if (!this.buffers.has(src.url) && src.url) {
        try {
          const buf = await this.engine.loadBuffer(src.url);
          this.buffers.set(src.url, buf);
        } catch (err) {
          log.warn('Failed to load audio: %s', src.url);
          continue;
        }
      }

      const buf = this.buffers.get(src.url);
      if (!buf) continue;

      // Start playback
      if (src.isPlaying && !src.handle) {
        src.handle = this.engine.play(buf, src.channel, src.options);
        src.handle.source.onended = () => {
          src.handle = null;
          if (!src.options.loop) src.isPlaying = false;
        };
      }

      // Update 3D position
      if (src.handle && src.options.spatial) {
        src.handle.setPosition(tf.position.x, tf.position.y, 0);
      }

      // Stop if requested
      if (!src.isPlaying && src.handle) {
        src.handle.stop();
        src.handle = null;
      }
    }
  }
}
