// DemoScene v2 — showcases all Midnight Engine systems
// UE5 power · Godot optimization · Desktop-ready
import { Scene }              from '../scene/Scene';
import { Renderer }           from '../rendering/Renderer';
import { Camera }             from '../rendering/Camera';
import { Transform }          from '../math/Transform';
import { SpriteComponent }    from '../rendering/SpriteComponent';
import { RigidBody }          from '../physics/RigidBody';
import { Collider }           from '../physics/Collider';
import { PhysicsSystem }      from '../physics/PhysicsSystem';
import { RenderSystem }       from '../rendering/RenderSystem';
import { AnimationSystem }    from '../animation/AnimationSystem';
import { AnimatorComponent }  from '../animation/AnimatorComponent';
import { AnimationClip }      from '../animation/AnimationClip';
import { HealthComponent }    from '../gameplay/HealthComponent';
import { CombatSystem }       from '../gameplay/CombatSystem';
import { Script }             from '../scripting/Script';
import { ScriptSystem }       from '../scripting/ScriptSystem';
import { Light2D }            from '../rendering/Light2D';
import { LightingSystem }     from '../rendering/LightingSystem';
import { ParticleEmitter }    from '../particles/ParticleEmitter';
import { ParticleEmitterSystem } from '../particles/ParticleEmitterSystem';
import { VisibilityNotifier, VisibilityNotifierSystem } from '../rendering/VisibilityNotifier';
import { Tilemap, TilemapRenderer } from '../rendering/Tilemap';
import { DebugDraw, globalDebug } from '../rendering/DebugDraw';
import { InputManager }       from '../input/InputManager';
import { Vec2 }               from '../math/Vec2';
import { MathUtils }          from '../math/MathUtils';
import type { ScriptContext }  from '../scripting/ScriptAPI';

// ─── Scripts ────────────────────────────────────────────────────────────────

const PlayerScript = {
  name: 'PlayerController',
  onUpdate(ctx: ScriptContext) {
    const mv   = ctx.input.getMovementVector();
    const body = ctx.body;
    if (!body || !ctx.transform) return;

    body.velocity.x = mv.x * 220;
    if (ctx.input.isActionPressed('Jump') && Math.abs(body.velocity.y) < 8) {
      body.applyImpulse(0, 520);
    }
    if (ctx.animator) {
      ctx.animator.setFloat('speed', Math.abs(mv.x));
      ctx.animator.setBool('inAir', Math.abs(body.velocity.y) > 12);
    }

    // Raycast downward — ground check (UE5 Chaos Raycast)
    const hit = (ctx as unknown as { _raycast?: (orig: Vec2, dir: Vec2) => unknown })._raycast?.(
      ctx.transform.position, new Vec2(0, -1)
    );
    // (just demonstrating the API is available)
  },
};

const SpinScript = {
  name: 'Spinner',
  onUpdate(ctx: ScriptContext) {
    if (ctx.transform) ctx.transform.rotation += ctx.dt * 1.8;
  },
};

const OrbiterScript = {
  name: 'Orbiter',
  angle: 0,
  radius: 80,
  speed: 1.2,
  onUpdate(ctx: ScriptContext) {
    this.angle += ctx.dt * this.speed;
    if (ctx.transform) {
      ctx.transform.position.x = Math.cos(this.angle) * this.radius;
      ctx.transform.position.y = Math.sin(this.angle) * this.radius + 40;
    }
  },
};

const BounceBallScript = {
  name: 'BounceBall',
  onUpdate(ctx: ScriptContext) {
    const body = ctx.body;
    if (!body || !ctx.transform) return;
    if (ctx.transform.position.x > 380 || ctx.transform.position.x < -380) {
      body.velocity.x *= -1;
      ctx.transform.position.x = MathUtils.clamp(ctx.transform.position.x, -380, 380);
    }
  },
};

// Flicker light script
const FlickerLightScript = {
  name: 'FlickerLight',
  onUpdate(ctx: ScriptContext) {
    const light = ctx.entity.getComponent(Light2D);
    if (light) {
      light.intensity = 1.2 + Math.sin(ctx.dt * 12 + ctx.entity.id) * 0.3;
    }
  },
};

export class DemoScene extends Scene {
  private inputRef: InputManager;
  private renderSys!: RenderSystem;
  private particleSys!: ParticleEmitterSystem;
  private lightingSys!: LightingSystem;
  private _time = 0;

  constructor(input: InputManager) {
    super('Demo');
    this.inputRef = input;
  }

  override async load(renderer: Renderer): Promise<void> {
    const gl = renderer.gl;

    // ── Systems ──────────────────────────────────────────────────────────────
    const physics  = new PhysicsSystem({ gravity: new Vec2(0, -500) });
    const anim     = new AnimationSystem();
    const combat   = new CombatSystem();
    const scripts  = new ScriptSystem();
    scripts.setInput(this.inputRef);

    this.renderSys   = new RenderSystem();
    this.renderSys.initGL(gl);

    this.particleSys = new ParticleEmitterSystem(renderer);
    this.lightingSys = new LightingSystem({
      ambientR: 0.06, ambientG: 0.06, ambientB: 0.14,
    });
    this.lightingSys.initGL(gl, renderer.canvas.width, renderer.canvas.height);

    const visNotifier = new VisibilityNotifierSystem();

    this.world.addSystem(physics);
    this.world.addSystem(anim);
    this.world.addSystem(combat);
    this.world.addSystem(scripts);
    this.world.addSystem(this.renderSys);
    this.world.addSystem(this.particleSys);
    this.world.addSystem(visNotifier);

    // Mount debug draw
    globalDebug.mount(renderer.canvas);
    globalDebug.config.enabled = false; // toggle with F3

    // ── Textures ─────────────────────────────────────────────────────────────
    const white  = renderer.createSolidTexture(255, 255, 255);
    const red    = renderer.createSolidTexture(220,  60,  60);
    const green  = renderer.createSolidTexture( 60, 200,  80);
    const blue   = renderer.createSolidTexture( 80, 140, 220);
    const gold   = renderer.createSolidTexture(255, 200,  30);
    const purple = renderer.createSolidTexture(180,  80, 220);
    const sky    = renderer.createSolidTexture( 12,  12,  22);
    const orange = renderer.createSolidTexture(240, 120,  30);

    // ── Camera ────────────────────────────────────────────────────────────────
    const camEntity = this.world.createEntity('Camera');
    camEntity.addComponent(new Transform(0, 0));
    const cam = camEntity.addComponent(new Camera());
    cam.zoom = 1;

    // ── Background ────────────────────────────────────────────────────────────
    const bg = this.world.createEntity('Background');
    bg.addComponent(new Transform(0, 0));
    const bgSpr = bg.addComponent(new SpriteComponent());
    bgSpr.texture = sky; bgSpr.width = 900; bgSpr.height = 650; bgSpr.layer = -100;

    // ── Tilemap (Godot TileMap) ───────────────────────────────────────────────
    const tmEntity = this.world.createEntity('Tilemap');
    tmEntity.addComponent(new Transform(-400, -280));
    const tm = tmEntity.addComponent(new Tilemap());
    tm.init(50, 4, 16, 16);
    tm.tileset = green;
    tm.tilesetCols = 1; tm.tilesetRows = 1;
    tm.registerTile(1, 0, 0, true);
    const layer = tm.addLayer('ground', 0);
    tm.fill(0, 0, 2, 50, 1, 1);  // ground row 2 & 3
    tm.fill(0, 0, 3, 50, 1, 1);
    tm.markAllDirty();

    // ── Ground (physics) ──────────────────────────────────────────────────────
    const ground = this.world.createEntity('Ground');
    ground.addComponent(new Transform(0, -252));
    const gs = ground.addComponent(new SpriteComponent());
    gs.texture = green; gs.width = 900; gs.height = 24; gs.layer = 1;
    const gb = ground.addComponent(new RigidBody());
    gb.bodyType = 'static';
    ground.addComponent(Collider.makeAABB(450, 12));

    // ── Platforms ─────────────────────────────────────────────────────────────
    const platforms = [
      { x: -200, y: -120, w: 160 },
      { x:  160, y:  -55, w: 130 },
      { x:    0, y:   75, w: 200 },
      { x: -290, y:   50, w:  90 },
      { x:  290, y:   20, w: 100 },
    ];
    for (const p of platforms) {
      const plat = this.world.createEntity('Platform');
      plat.addComponent(new Transform(p.x, p.y));
      const ps = plat.addComponent(new SpriteComponent());
      ps.texture = blue; ps.width = p.w; ps.height = 14; ps.layer = 1;
      const pb = plat.addComponent(new RigidBody());
      pb.bodyType = 'static';
      plat.addComponent(Collider.makeAABB(p.w / 2, 7));
    }

    // ── Player ────────────────────────────────────────────────────────────────
    const player = this.world.createEntity('Player');
    player.addComponent(new Transform(0, -200));
    const pSprite = player.addComponent(new SpriteComponent());
    pSprite.texture = red; pSprite.width = 28; pSprite.height = 44; pSprite.layer = 5;
    const pBody = player.addComponent(new RigidBody());
    pBody.setMass(1); pBody.freezeRotation = true; pBody.linearDamping = 0.08;
    player.addComponent(Collider.makeAABB(12, 20));
    player.addComponent(new HealthComponent(100));

    const idleClip = new AnimationClip('idle', [{ uvX:0, uvY:0, uvW:1, uvH:1, duration:0.5 }], true);
    const runClip  = new AnimationClip('run',  [
      { uvX:0, uvY:0, uvW:1, uvH:1, duration:0.08 },
      { uvX:0, uvY:0, uvW:1, uvH:1, duration:0.08 },
    ], true);
    const animator = player.addComponent(new AnimatorComponent());
    animator.stateMachine
      .addState({ name:'idle', clip:idleClip, transitions:[{ toState:'run', conditions:[{ param:'speed', op:'>', value:0.1 }] }] })
      .addState({ name:'run',  clip:runClip,  transitions:[{ toState:'idle', conditions:[{ param:'speed', op:'<', value:0.1 }] }] })
      .setEntry('idle');
    player.addComponent(new Script()).addScript(PlayerScript);
    cam.followTarget = player.requireComponent(Transform).position;
    cam.followSpeed  = 5;

    // Player light (follows player — UE5-style dynamic light)
    const pLight = this.world.createEntity('PlayerLight');
    pLight.addComponent(new Transform(0, -200));
    const pl = pLight.addComponent(new Light2D());
    pl.r = 1; pl.g = 0.85; pl.b = 0.6;
    pl.intensity = 2; pl.radius = 250;
    pl.flickerAmount = 0.04;

    // ── Particle emitters ─────────────────────────────────────────────────────
    // Fire emitter
    const fire = this.world.createEntity('FireEmitter');
    fire.addComponent(new Transform(-280, -238));
    const fireEmit = fire.addComponent(new ParticleEmitter());
    fireEmit.params = {
      maxParticles: 300, emissionRate: 80, looping: true,
      shapeType: 'circle', shapeRadius: 8,
      color:    { startColor:[1, 0.5, 0.1, 1], endColor:[0.9, 0.1, 0.0, 0] },
      size:     { startSize: 18, endSize: 2 },
      velocity: { minSpeed:40, maxSpeed:90, spreadAngle:50, emitDirection:Math.PI/2,
                  gravity: new Vec2(0, 20), drag:0.97 },
      lifetime: { minLifetime:0.4, maxLifetime:1.1 },
      startRotation:0, rotationSpeed:1,
      uvX:0, uvY:0, uvW:1, uvH:1,
      blendMode: 1,  // additive — UE5-style fire glow
      softEdge: true,
    };
    // Fire point light
    const fireLightE = this.world.createEntity('FireLight');
    fireLightE.addComponent(new Transform(-280, -220));
    const fl = fireLightE.addComponent(new Light2D());
    fl.r=1; fl.g=0.5; fl.b=0.1; fl.intensity=2.5; fl.radius=200; fl.flickerAmount=0.15;
    fireLightE.addComponent(new Script()).addScript(FlickerLightScript);

    // Spark emitter
    const sparks = this.world.createEntity('SparkEmitter');
    sparks.addComponent(new Transform(280, -238));
    const sparkEmit = sparks.addComponent(new ParticleEmitter());
    sparkEmit.params = {
      maxParticles: 200, emissionRate: 40, looping: true,
      shapeType: 'point',
      color:    { startColor:[0.8, 0.9, 1, 1], endColor:[0.4, 0.5, 1, 0] },
      size:     { startSize: 6, endSize: 0 },
      velocity: { minSpeed:80, maxSpeed:200, spreadAngle:360, emitDirection:0,
                  gravity: new Vec2(0, -120), drag:0.95 },
      lifetime: { minLifetime:0.3, maxLifetime:0.8 },
      startRotation:0, rotationSpeed:3,
      uvX:0, uvY:0, uvW:1, uvH:1,
      blendMode: 1, softEdge: false,
    };
    const sparkLightE = this.world.createEntity('SparkLight');
    sparkLightE.addComponent(new Transform(280, -220));
    const sl = sparkLightE.addComponent(new Light2D());
    sl.r=0.5; sl.g=0.6; sl.b=1; sl.intensity=1.8; sl.radius=160; sl.flickerAmount=0.2;

    // ── Spinning coins (Godot groups demo) ────────────────────────────────────
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const coin = this.world.createEntity(`Coin_${i}`);
      coin.addComponent(new Transform(Math.cos(angle) * 140, Math.sin(angle) * 70 + 30));
      const cs = coin.addComponent(new SpriteComponent());
      cs.texture = gold; cs.width = 14; cs.height = 14; cs.layer = 3;
      coin.addComponent(new Script()).addScript(SpinScript);

      // VisibilityNotifier — disable AI when off-screen (Godot pattern)
      const vis = coin.addComponent(new VisibilityNotifier());
      vis.halfW = 10; vis.halfH = 10;
      vis.onBecameInvisible = () => { cs.enabled = false; };
      vis.onBecameVisible   = () => { cs.enabled = true;  };
    }

    // ── Orbiting moon light ────────────────────────────────────────────────────
    const moon = this.world.createEntity('Moon');
    moon.addComponent(new Transform(0, 40));
    const moonSpr = moon.addComponent(new SpriteComponent());
    moonSpr.texture = purple; moonSpr.width = 20; moonSpr.height = 20; moonSpr.layer = 2;
    const moonLight = moon.addComponent(new Light2D());
    moonLight.r=0.6; moonLight.g=0.5; moonLight.b=1.0; moonLight.intensity=1.6; moonLight.radius=220;
    moon.addComponent(new Script()).addScript(OrbiterScript);

    // ── Bouncing balls (physics demo) ─────────────────────────────────────────
    const ballColors = [white, red, purple, orange];
    for (let i = 0; i < 6; i++) {
      const ball = this.world.createEntity(`Ball_${i}`);
      ball.addComponent(new Transform(MathUtils.randFloat(-280, 280), MathUtils.randFloat(-80, 100)));
      const bs = ball.addComponent(new SpriteComponent());
      bs.texture = ballColors[i % ballColors.length];
      bs.width = 20; bs.height = 20; bs.layer = 2;
      bs.r = MathUtils.randFloat(0.6,1);
      bs.g = MathUtils.randFloat(0.4,1);
      bs.b = MathUtils.randFloat(0.5,1);
      const bb = ball.addComponent(new RigidBody());
      bb.setMass(0.6); bb.restitution = 0.85;
      bb.velocity.set(MathUtils.randFloat(-160,160), MathUtils.randFloat(-80,200));
      ball.addComponent(Collider.makeCircle(10));
      ball.addComponent(new Script()).addScript(BounceBallScript);
    }

    // ── Ambient light (global fill) ───────────────────────────────────────────
    const ambientE = this.world.createEntity('AmbientLight');
    ambientE.addComponent(new Transform(0, 0));
    const ambient = ambientE.addComponent(new Light2D());
    ambient.lightType = 'ambient';
    ambient.r=0.15; ambient.g=0.15; ambient.b=0.3; ambient.intensity=1; ambient.radius=10000;
  }

  override update(dt: number): void {
    this._time += dt;
    super.update(dt);

    // Sync player light to player
    const player    = this.world.findByName('Player');
    const pLightE   = this.world.findByName('PlayerLight');
    if (player && pLightE) {
      const ptf = player.getComponent(Transform);
      const ltf = pLightE.getComponent(Transform);
      if (ptf && ltf) {
        ltf.position.x = ptf.position.x;
        ltf.position.y = ptf.position.y + 20;
      }
    }

    // Debug stats
    const cam = this.world.queryFirst(Camera);
    if (cam && globalDebug.config.enabled) {
      globalDebug.text(-380, 270,
        `Cull rate: ${Math.round(this.renderSys.cullRate * 100)}%`, '#a78bfa');
    }
  }

  override render(renderer: Renderer, alpha: number): void {
    const camEntity = this.world.queryFirst(Camera);
    if (!camEntity) return;
    const cam = camEntity.requireComponent(Camera);
    cam.viewWidth  = renderer.canvas.width;
    cam.viewHeight = renderer.canvas.height;
    cam.update(alpha);

    // Pass matrices to render system
    const proj = cam.getProjectionMatrix().data;
    const view = cam.getViewMatrix().data;
    this.renderSys.setBuffers(proj, view);
    this.renderSys.setAlpha(alpha);
    this.renderSys.setTime(this._time);

    // Scene → offscreen FBO via post stack
    renderer.beginFrame(cam);

    // Flush tilemaps + sprites
    this.renderSys.flush(renderer.gl);

    // Flush particles (additive on top)
    this.particleSys.drawAll(proj, view);

    // Blit post-fx
    renderer.endFrame(1 / 60);

    // Debug overlay (canvas2d layer, zero GL cost)
    globalDebug.render(
      1 / 60, cam,
      renderer['loop' as keyof typeof renderer] as unknown as number ?? 60,
      renderer.drawCalls,
      this.world.getAllEntities().length,
    );
  }
}
