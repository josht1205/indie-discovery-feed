// SceneManager — handles loading/unloading scenes and transitions
import { Scene }    from './Scene';
import { Renderer } from '../rendering/Renderer';
import { createLogger } from '../core/Logger';
import { EventEmitter } from '../core/EventEmitter';

const log = createLogger('SceneManager');

export type TransitionType = 'instant' | 'fade';

export class SceneManager {
  readonly events = new EventEmitter();
  private scenes  = new Map<string, Scene>();
  private _current: Scene | null = null;
  private _next:    Scene | null = null;
  private renderer!: Renderer;

  // Fade transition state
  fadeAlpha  = 0;
  fadeDuration = 0.5;
  private _fading  = false;
  private _fadeDir = 1;
  private _fadeCallback?: () => void;

  get current(): Scene | null { return this._current; }

  init(renderer: Renderer): void { this.renderer = renderer; }

  register(scene: Scene): void {
    this.scenes.set(scene.name, scene);
    log.debug('Scene registered: %s', scene.name);
  }

  async goto(name: string, transition: TransitionType = 'fade'): Promise<void> {
    const next = this.scenes.get(name);
    if (!next) { log.error('Scene not found: %s', name); return; }

    log.info('Transitioning to scene: %s (transition=%s)', name, transition);

    if (transition === 'instant' || !this._current) {
      await this._swap(next);
      return;
    }

    // Fade-out → swap → fade-in
    this._fading  = true;
    this._fadeDir = 1;
    this._fadeCallback = async () => {
      await this._swap(next);
      this._fadeDir = -1;
    };
  }

  private async _swap(next: Scene): Promise<void> {
    this._current?.unload();
    await next.load(this.renderer);
    this._current = next;
    this.events.emit('scene:changed', next.name);
  }

  update(dt: number): void {
    // Fade tween
    if (this._fading) {
      this.fadeAlpha += this._fadeDir * dt / this.fadeDuration;
      if (this._fadeDir > 0 && this.fadeAlpha >= 1) {
        this.fadeAlpha = 1;
        this._fadeCallback?.();
        this._fadeCallback = undefined;
      }
      if (this._fadeDir < 0 && this.fadeAlpha <= 0) {
        this.fadeAlpha = 0;
        this._fading   = false;
      }
    }

    this._current?.update(dt);
  }

  fixedUpdate(dt: number): void {
    this._current?.fixedUpdate(dt);
  }

  render(alpha: number): void {
    if (this._current && this.renderer) {
      this._current.render(this.renderer, alpha);
    }
  }
}
