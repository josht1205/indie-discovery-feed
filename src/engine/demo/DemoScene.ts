// DemoScene — interactive showcase of Midnight Engine capabilities
// Renders procedural colored sprites with physics, input, and animation
import { Scene }             from '../scene/Scene';
import { Renderer }          from '../rendering/Renderer';
import { Camera }            from '../rendering/Camera';
import { Transform }         from '../math/Transform';
import { SpriteComponent }   from '../rendering/SpriteComponent';
import { RigidBody }         from '../physics/RigidBody';
import { Collider }          from '../physics/Collider';
import { PhysicsSystem }     from '../physics/PhysicsSystem';
import { AnimationSystem }   from '../animation/AnimationSystem';
import { AnimatorComponent } from '../animation/AnimatorComponent';
import { AnimationClip }     from '../animation/AnimationClip';
import { AnimationStateMachine } from '../animation/AnimationStateMachine';
import { HealthComponent }   from '../gameplay/HealthComponent';
import { CombatComponent }   from '../gameplay/CombatComponent';
import { CombatSystem }      from '../gameplay/CombatSystem';
import { Script }            from '../scripting/Script';
import { ScriptSystem }      from '../scripting/ScriptSystem';
import { InputManager }      from '../input/InputManager';
import { Vec2 }              from '../math/Vec2';
import { MathUtils }         from '../math/MathUtils';
import type { ScriptContext } from '../scripting/ScriptAPI';

// ─── Player controller script ───────────────────────────────────────────────
const PlayerScript = {
  name: 'PlayerController',
  speed: 200,
  jumpForce: 500,
  onUpdate(ctx: ScriptContext) {
    const mv   = ctx.input.getMovementVector();
    const body = ctx.body;
    if (!body || !ctx.transform) return;

    // Horizontal movement
    body.velocity.x = mv.x * 200;

    // Jump
    if (ctx.input.isActionPressed('Jump') && Math.abs(body.velocity.y) < 5) {
      body.applyImpulse(0, 500);
    }

    // Animate
    if (ctx.animator) {
      ctx.animator.setFloat('speed', Math.abs(mv.x));
      ctx.animator.setBool('inAir', Math.abs(body.velocity.y) > 10);
    }
  },
};

// ─── Spinning coin script ────────────────────────────────────────────────────
const SpinScript = {
  name: 'Spinner',
  onUpdate(ctx: ScriptContext) {
    if (ctx.transform) ctx.transform.rotation += ctx.dt * 2;
  },
};

// ─── Bouncing ball script ────────────────────────────────────────────────────
const BounceBallScript = {
  name: 'BounceBall',
  onUpdate(ctx: ScriptContext) {
    const body = ctx.body;
    if (!body || !ctx.transform) return;
    // Constrain to world width
    if (ctx.transform.position.x > 380 || ctx.transform.position.x < -380) {
      body.velocity.x *= -1;
      ctx.transform.position.x = MathUtils.clamp(ctx.transform.position.x, -380, 380);
    }
  },
};

export class DemoScene extends Scene {
  private inputRef!: InputManager;

  constructor(input: InputManager) {
    super('Demo');
    this.inputRef = input;
  }

  override async load(renderer: Renderer): Promise<void> {
    // ── Systems ──────────────────────────────────────────────────────────────
    const physics  = new PhysicsSystem({ gravity: new Vec2(0, -500) });
    const anim     = new AnimationSystem();
    const combat   = new CombatSystem();
    const scripts  = new ScriptSystem();
    scripts.setInput(this.inputRef);

    this.world.addSystem(physics);
    this.world.addSystem(anim);
    this.world.addSystem(combat);
    this.world.addSystem(scripts);

    // ── Camera ───────────────────────────────────────────────────────────────
    const camEntity = this.world.createEntity('Camera');
    camEntity.addComponent(new Transform(0, 0));
    const cam = camEntity.addComponent(new Camera());
    cam.zoom = 1;

    // ── Textures (solid colour placeholders) ─────────────────────────────────
    const gl = renderer.gl;
    const whiteT  = renderer.createSolidTexture(255, 255, 255);
    const redT    = renderer.createSolidTexture(220,  60,  60);
    const greenT  = renderer.createSolidTexture( 60, 200,  80);
    const blueT   = renderer.createSolidTexture( 80, 140, 220);
    const goldT   = renderer.createSolidTexture(255, 200,  30);
    const skyT    = renderer.createSolidTexture( 30,  30,  50);

    // ── Background / sky panel ───────────────────────────────────────────────
    const bg = this.world.createEntity('Background');
    bg.addComponent(new Transform(0, 0));
    const bgSprite = bg.addComponent(new SpriteComponent());
    bgSprite.texture = skyT;
    bgSprite.width   = 800;
    bgSprite.height  = 600;
    bgSprite.layer   = -10;

    // ── Ground platform ───────────────────────────────────────────────────────
    const ground = this.world.createEntity('Ground');
    ground.addComponent(new Transform(0, -250));
    const groundSprite = ground.addComponent(new SpriteComponent());
    groundSprite.texture = greenT;
    groundSprite.width   = 800;
    groundSprite.height  = 40;
    const groundBody = ground.addComponent(new RigidBody());
    groundBody.bodyType = 'static';
    const groundCol = ground.addComponent(Collider.makeAABB(400, 20));

    // ── Floating platforms ───────────────────────────────────────────────────
    const platforms = [
      { x: -200, y: -120, w: 150 },
      { x:  150, y:  -50, w: 120 },
      { x:    0, y:   80, w: 180 },
      { x: -280, y:   60, w: 100 },
    ];
    for (const p of platforms) {
      const plat = this.world.createEntity('Platform');
      plat.addComponent(new Transform(p.x, p.y));
      const ps = plat.addComponent(new SpriteComponent());
      ps.texture = blueT;
      ps.width   = p.w;
      ps.height  = 16;
      const pb = plat.addComponent(new RigidBody());
      pb.bodyType = 'static';
      plat.addComponent(Collider.makeAABB(p.w / 2, 8));
    }

    // ── Player ────────────────────────────────────────────────────────────────
    const player = this.world.createEntity('Player');
    player.addComponent(new Transform(0, -200));

    const playerSprite = player.addComponent(new SpriteComponent());
    playerSprite.texture = redT;
    playerSprite.width   = 32;
    playerSprite.height  = 48;
    playerSprite.layer   = 1;

    const playerBody = player.addComponent(new RigidBody());
    playerBody.setMass(1);
    playerBody.freezeRotation = true;
    playerBody.linearDamping  = 0.1;

    player.addComponent(Collider.makeAABB(14, 22));
    player.addComponent(new HealthComponent(100));

    // Simple animation clips (using solid color texture — just tint flashing)
    const idleClip = new AnimationClip('idle', [
      { uvX: 0, uvY: 0, uvW: 1, uvH: 1, duration: 0.5 },
      { uvX: 0, uvY: 0, uvW: 1, uvH: 1, duration: 0.5 },
    ], true);
    const runClip = new AnimationClip('run', [
      { uvX: 0, uvY: 0, uvW: 1, uvH: 1, duration: 0.1 },
      { uvX: 0, uvY: 0, uvW: 1, uvH: 1, duration: 0.1 },
      { uvX: 0, uvY: 0, uvW: 1, uvH: 1, duration: 0.1 },
      { uvX: 0, uvY: 0, uvW: 1, uvH: 1, duration: 0.1 },
    ], true);

    const animator = player.addComponent(new AnimatorComponent());
    animator.stateMachine
      .addState({ name: 'idle', clip: idleClip, transitions: [{ toState: 'run', conditions: [{ param: 'speed', op: '>', value: 0.1 }] }] })
      .addState({ name: 'run',  clip: runClip,  transitions: [{ toState: 'idle', conditions: [{ param: 'speed', op: '<', value: 0.1 }] }] })
      .setEntry('idle');

    const playerScript = player.addComponent(new Script());
    playerScript.addScript(PlayerScript);

    // Follow camera
    cam.followTarget = player.requireComponent(Transform).position;
    cam.followSpeed  = 6;

    // ── Spinning coins ────────────────────────────────────────────────────────
    for (let i = 0; i < 8; i++) {
      const coin = this.world.createEntity(`Coin_${i}`);
      const angle = (i / 8) * Math.PI * 2;
      coin.addComponent(new Transform(Math.cos(angle) * 150, Math.sin(angle) * 80 + 30));
      const cs = coin.addComponent(new SpriteComponent());
      cs.texture = goldT;
      cs.width   = 16;
      cs.height  = 16;
      cs.layer   = 2;
      const coinScript = coin.addComponent(new Script());
      coinScript.addScript(SpinScript);
    }

    // ── Bouncing enemy balls ─────────────────────────────────────────────────
    const colors = [whiteT, redT, blueT];
    for (let i = 0; i < 5; i++) {
      const ball = this.world.createEntity(`Ball_${i}`);
      ball.addComponent(new Transform(
        MathUtils.randFloat(-300, 300),
        MathUtils.randFloat(-100, 100),
      ));
      const bs = ball.addComponent(new SpriteComponent());
      bs.texture = colors[i % colors.length];
      bs.width   = 24;
      bs.height  = 24;
      bs.r = MathUtils.randFloat(0.5, 1);
      bs.g = MathUtils.randFloat(0.5, 1);
      bs.b = MathUtils.randFloat(0.5, 1);

      const bBody = ball.addComponent(new RigidBody());
      bBody.setMass(0.5);
      bBody.restitution = 0.9;
      bBody.velocity.set(
        MathUtils.randFloat(-150, 150),
        MathUtils.randFloat(-100, 200),
      );

      ball.addComponent(Collider.makeCircle(12));
      ball.addComponent(new Script()).addScript(BounceBallScript);
    }
  }
}
