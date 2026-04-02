// Engine — top-level orchestrator for the Midnight Engine
// Initialises all subsystems and drives the game loop
import { GameLoop }      from './GameLoop';
import { EventEmitter }  from './EventEmitter';
import { createLogger, LogLevel } from './Logger';
import { Renderer, RendererConfig } from '../rendering/Renderer';
import { SceneManager }  from '../scene/SceneManager';
import { InputManager }  from '../input/InputManager';
import { AudioEngine }   from '../audio/AudioEngine';

const log = createLogger('Engine');

export interface EngineConfig {
  canvas:      HTMLCanvasElement;
  width?:      number;
  height?:     number;
  targetFPS?:  number;          // desired fixed-step rate (default 60)
  pixelArt?:   boolean;         // disable AA, use nearest-neighbor
  debug?:      boolean;
  renderer?:   Partial<RendererConfig>;
}

export interface EngineStats {
  fps:       number;
  frameTime: number;
  drawCalls: number;
}

export class Engine {
  static readonly VERSION = '0.1.0';

  readonly events:   EventEmitter  = new EventEmitter();
  readonly loop:     GameLoop;
  readonly renderer: Renderer;
  readonly scenes:   SceneManager  = new SceneManager();
  readonly input:    InputManager;
  readonly audio:    AudioEngine   = new AudioEngine();

  private _running = false;
  readonly stats:  EngineStats = { fps: 0, frameTime: 0, drawCalls: 0 };

  constructor(config: EngineConfig) {
    if (config.debug) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window as any).__midnight = this;
    }

    // Renderer
    this.renderer = new Renderer({
      canvas:    config.canvas,
      width:     config.width,
      height:    config.height,
      ...config.renderer,
    });

    // Input
    this.input = new InputManager(config.canvas);
    this.input.registerDefaults();

    // Scene manager
    this.scenes.init(this.renderer);

    // Game loop
    this.loop = new GameLoop({ fixedStep: 1 / (config.targetFPS ?? 60) });

    this.loop.onFixedUpdate = (dt) => {
      this.input.update();
      this.scenes.fixedUpdate(dt);
      this.events.emit('fixedUpdate', dt);
    };

    this.loop.onUpdate = (dt) => {
      this.scenes.update(dt);
      this.events.emit('update', dt);
    };

    this.loop.onRender = (alpha) => {
      this.scenes.render(alpha);
      this.stats.fps       = this.loop.fps;
      this.stats.frameTime = this.loop.frameTime;
      this.stats.drawCalls = this.renderer.drawCalls;
      this.events.emit('render', alpha);
    };

    // Auto-resize
    const ro = new ResizeObserver(() => this._handleResize());
    ro.observe(config.canvas.parentElement ?? document.body);

    log.info('Midnight Engine v%s initialized', Engine.VERSION);
  }

  /** Start the engine. Call after registering scenes. */
  start(): void {
    if (this._running) return;
    this._running = true;
    this.loop.start();
    this.events.emit('start');
    log.info('Engine started');
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    this.loop.stop();
    this.events.emit('stop');
    log.info('Engine stopped');
  }

  /** Shorthand: go to a named scene */
  async goto(sceneName: string): Promise<void> {
    return this.scenes.goto(sceneName);
  }

  /** Unlock audio — must be called from a user gesture */
  async unlockAudio(): Promise<void> {
    await this.audio.init();
  }

  get running(): boolean { return this._running; }

  private _handleResize(): void {
    const canvas = this.renderer.canvas;
    const parent = canvas.parentElement;
    if (!parent) return;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.renderer.resize(w, h);
    this.events.emit('resize', { width: w, height: h });
  }
}
