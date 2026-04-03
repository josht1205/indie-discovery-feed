// RenderSystem — Godot-style decoupled rendering server
// Collects SpriteComponents into a RenderCommandBuffer each frame,
// applies frustum culling, sorts by layer+y, then flushes to SpriteBatch in one pass.
// This architecture allows: multi-threaded command collection (future),
// render-order overrides, and zero state changes between similar textures.

import { System }              from '../ecs/System';
import { SpriteComponent }     from './SpriteComponent';
import { Transform }           from '../math/Transform';
import { Camera }              from './Camera';
import { SpriteBatch }         from './SpriteBatch';
import { FrustumCuller }       from './FrustumCuller';
import { RenderCommandBuffer, RenderCommandType } from './RenderCommand';
import { TilemapRenderer, Tilemap } from './Tilemap';
import { globalDebug }         from './DebugDraw';
import { Collider }            from '../physics/Collider';
import { RigidBody }           from '../physics/RigidBody';
import { Light2D }             from './Light2D';
import { createLogger }        from '../core/Logger';

const log = createLogger('RenderSystem');

export class RenderSystem extends System {
  priority = 200;  // runs last

  private spriteBatch!:   SpriteBatch;
  private culler:         FrustumCuller = new FrustumCuller();
  private cmdBuffer:      RenderCommandBuffer = new RenderCommandBuffer();
  private tilemapRenderer!: TilemapRenderer;
  private projMatrix!:    Float32Array;
  private viewMatrix!:    Float32Array;
  private renderAlpha     = 1;
  private _time           = 0;

  // Shared with Engine so Renderer can call beginFrame/endFrame
  setBuffers(proj: Float32Array, view: Float32Array): void {
    this.projMatrix = proj;
    this.viewMatrix = view;
  }
  setAlpha(a: number):   void { this.renderAlpha = a; }
  setTime(t: number):    void { this._time = t; }

  initGL(gl: WebGL2RenderingContext): void {
    this.spriteBatch    = new SpriteBatch(gl);
    this.tilemapRenderer = new TilemapRenderer(gl);
    log.debug('RenderSystem GL resources initialized');
  }

  override update(dt: number): void {
    this._time += dt;

    const camEntity = this.world.queryFirst(Camera);
    if (!camEntity) return;
    const cam = camEntity.requireComponent(Camera);
    cam.update(dt);

    this.projMatrix = cam.getProjectionMatrix().data;
    this.viewMatrix = cam.getViewMatrix().data;

    // Update frustum culler
    this.culler.updateFromCamera(cam);

    // ── Collect render commands ─────────────────────────────────────────────
    this.cmdBuffer.reset();

    const spriteEntities = this.world.query(Transform, SpriteComponent);
    for (const e of spriteEntities) {
      const tf     = e.requireComponent(Transform);
      const sprite = e.requireComponent(SpriteComponent);
      if (!sprite.enabled || !sprite.texture) continue;

      const interp = tf.interpolated(this.renderAlpha);
      const hw = (sprite.width  * Math.abs(tf.scale.x)) / 2;
      const hh = (sprite.height * Math.abs(tf.scale.y)) / 2;

      // ── FRUSTUM CULL ─────────────────────────────────────────────────────
      if (!this.culler.isVisibleSprite(interp.x, interp.y, hw, hh)) continue;

      // Sort key: layer * 1e7 + (y mapped to positive range)
      const sortKey = sprite.layer * 1e7 + interp.y * 10;

      this.cmdBuffer.push({
        type:     RenderCommandType.Sprite,
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
        sortKey,
      });
    }

    // Sort by layer + y (nearly sorted each frame → insertion sort is O(n))
    this.cmdBuffer.sort();

    // ── Debug overlays ──────────────────────────────────────────────────────
    const dbg = globalDebug;
    if (dbg.config.enabled) {
      if (dbg.config.showPhysics) {
        for (const e of this.world.query(Transform, Collider)) {
          const col = e.requireComponent(Collider);
          const tf  = e.requireComponent(Transform);
          if (col.shape === 'aabb' && col.aabb) {
            dbg.rect(tf.position.x + col.offsetX, tf.position.y + col.offsetY,
              col.aabb.halfW * 2, col.aabb.halfH * 2, '#00ff88');
          } else if (col.shape === 'circle' && col.circle) {
            dbg.circle(tf.position.x + col.offsetX, tf.position.y + col.offsetY,
              col.circle.radius, '#00ffcc');
          }
        }
      }
      if (dbg.config.showVelocity) {
        for (const e of this.world.query(Transform, RigidBody)) {
          const body = e.requireComponent(RigidBody);
          const tf   = e.requireComponent(Transform);
          if (body.velocity.length() > 1) {
            dbg.arrow(tf.position, tf.position.add(body.velocity.mul(0.1)), '#ffff00');
          }
        }
      }
      if (dbg.config.showLights) {
        for (const e of this.world.query(Transform, Light2D)) {
          const light = e.requireComponent(Light2D);
          const tf    = e.requireComponent(Transform);
          dbg.circle(tf.position.x, tf.position.y, light.radius,
            `rgba(${Math.round(light.r*255)},${Math.round(light.g*255)},${Math.round(light.b*255)},0.3)`);
        }
      }
    }
  }

  /** Called by Scene.render() after update() — flushes to GPU */
  flush(gl: WebGL2RenderingContext): void {
    if (!this.projMatrix) return;

    // ── Tilemaps first (ground layer) ───────────────────────────────────────
    for (const e of this.world.query(Tilemap)) {
      const tm = e.requireComponent(Tilemap);
      this.tilemapRenderer.upload(tm);
      this.tilemapRenderer.draw(tm, this.projMatrix, this.viewMatrix);
    }

    // ── Sprite batch ────────────────────────────────────────────────────────
    this.spriteBatch.begin();
    this.cmdBuffer.forEach((cmd) => {
      if (cmd.type === RenderCommandType.Sprite) {
        this.spriteBatch.draw(cmd);
      }
    });
    this.spriteBatch.flush(this.projMatrix, this.viewMatrix);
  }

  get cullRate(): number { return this.culler.cullRate; }

  override destroy(): void {
    this.spriteBatch?.destroy();
    this.tilemapRenderer?.destroy();
  }
}
