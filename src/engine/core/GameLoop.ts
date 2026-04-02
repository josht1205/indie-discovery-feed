// GameLoop — fixed-timestep update with variable render interpolation
// Physics/Logic: fixed at FIXED_STEP (default 60Hz)
// Render: uncapped, receives alpha for interpolation
import { createLogger } from './Logger';

const log = createLogger('GameLoop');

export type UpdateFn   = (dt: number) => void;
export type RenderFn   = (alpha: number) => void;

export interface GameLoopOptions {
  fixedStep?: number;   // seconds; default 1/60
  maxAccum?:  number;   // max accumulated time to prevent spiral of death; default 0.2
}

export class GameLoop {
  private fixedStep: number;
  private maxAccum: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  onFixedUpdate: UpdateFn = () => {};
  onUpdate:      UpdateFn = () => {};  // variable-rate (receives real dt)
  onRender:      RenderFn = () => {};

  // Diagnostics
  fps    = 0;
  frameTime = 0;
  private _fpsAcc = 0;
  private _fpsFrames = 0;

  constructor(opts: GameLoopOptions = {}) {
    this.fixedStep = opts.fixedStep ?? 1 / 60;
    this.maxAccum  = opts.maxAccum  ?? 0.2;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    log.info('Starting game loop, fixedStep=%dms', this.fixedStep * 1000);
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;
    cancelAnimationFrame(this.rafId);
    log.info('Game loop stopped');
  }

  private tick = (now: number): void => {
    if (!this.running) return;

    const rawDt = Math.min((now - this.lastTime) / 1000, this.maxAccum);
    this.lastTime = now;
    this.frameTime = rawDt;

    // FPS counter (updated every second)
    this._fpsAcc += rawDt;
    this._fpsFrames++;
    if (this._fpsAcc >= 1) {
      this.fps = Math.round(this._fpsFrames / this._fpsAcc);
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }

    // Variable update (UI, particles, non-deterministic logic)
    this.onUpdate(rawDt);

    // Fixed timestep integration
    this.accumulator += rawDt;
    while (this.accumulator >= this.fixedStep) {
      this.onFixedUpdate(this.fixedStep);
      this.accumulator -= this.fixedStep;
    }

    // Render with interpolation alpha [0,1]
    const alpha = this.accumulator / this.fixedStep;
    this.onRender(alpha);

    this.rafId = requestAnimationFrame(this.tick);
  };
}
