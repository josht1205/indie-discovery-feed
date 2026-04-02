// Scene — a self-contained game world with its own ECS World and systems
import { World }         from '../ecs/World';
import { System }        from '../ecs/System';
import { Renderer }      from '../rendering/Renderer';
import { Camera }        from '../rendering/Camera';
import { SpriteComponent } from '../rendering/SpriteComponent';
import { Transform }     from '../math/Transform';
import { createLogger }  from '../core/Logger';

const log = createLogger('Scene');

export abstract class Scene {
  readonly name: string;
  readonly world: World = new World();
  protected renderer!: Renderer;

  constructor(name: string) { this.name = name; }

  /** Called once when this scene becomes active */
  abstract load(renderer: Renderer): Promise<void>;

  /** Called once per fixed timestep */
  fixedUpdate(dt: number): void { this.world.fixedUpdate(dt); }

  /** Called once per frame */
  update(dt: number): void {
    this.world.update(dt);
    this.world.lateUpdate(dt);
  }

  /** Render all sprites in the scene */
  render(renderer: Renderer, alpha: number): void {
    // Find active camera
    const camEntity = this.world.queryFirst(Camera);
    if (!camEntity) {
      log.warn('Scene "%s" has no Camera entity', this.name);
      return;
    }
    const cam = camEntity.requireComponent(Camera);
    cam.update(alpha);  // advance shake / follow

    renderer.beginFrame(cam);

    // Sort sprites by layer then y-position for painter's algorithm
    const spriteEntities = this.world.query(Transform, SpriteComponent)
      .sort((a, b) => {
        const sa = a.requireComponent(SpriteComponent);
        const sb = b.requireComponent(SpriteComponent);
        if (sa.layer !== sb.layer) return sa.layer - sb.layer;
        return a.requireComponent(Transform).position.y - b.requireComponent(Transform).position.y;
      });

    for (const e of spriteEntities) {
      const tf     = e.requireComponent(Transform);
      const sprite = e.requireComponent(SpriteComponent);
      if (!sprite.texture || !sprite.enabled) continue;

      const interp = tf.interpolated(alpha);
      renderer.drawSprite({
        texture:  sprite.texture,
        x:        interp.x,
        y:        interp.y,
        width:    sprite.width,
        height:   sprite.height,
        rotation: interp.rotation,
        scaleX:   tf.scale.x * (sprite.flipX ? -1 : 1),
        scaleY:   tf.scale.y * (sprite.flipY ? -1 : 1),
        r: sprite.r, g: sprite.g, b: sprite.b, a: sprite.a,
        uvX: sprite.uvX, uvY: sprite.uvY, uvW: sprite.uvW, uvH: sprite.uvH,
      });
    }

    renderer.endFrame(alpha);
  }

  /** Called when this scene is unloaded */
  unload(): void {
    this.world.clear();
    log.info('Scene "%s" unloaded', this.name);
  }
}
