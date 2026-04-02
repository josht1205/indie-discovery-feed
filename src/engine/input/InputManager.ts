// InputManager — unified input facade with action mapping
// Actions decouple game logic from physical input devices
import { Keyboard }       from './Keyboard';
import { Mouse }          from './Mouse';
import { GamepadManager } from './Gamepad';

export type ActionBinding =
  | { device: 'keyboard'; code: string }
  | { device: 'mouse';    button: number }
  | { device: 'gamepad';  button: number; padIndex?: number };

export interface InputAction {
  name: string;
  bindings: ActionBinding[];
}

export class InputManager {
  readonly keyboard: Keyboard;
  readonly mouse:    Mouse;
  readonly gamepad:  GamepadManager;

  private actions = new Map<string, ActionBinding[]>();

  constructor(canvas: HTMLCanvasElement) {
    this.keyboard = new Keyboard();
    this.mouse    = new Mouse(canvas);
    this.gamepad  = new GamepadManager();
  }

  /** Register a named action with one or more bindings */
  registerAction(name: string, ...bindings: ActionBinding[]): void {
    this.actions.set(name, bindings);
  }

  /** Bulk-register a set of common platformer actions */
  registerDefaults(): void {
    this.registerAction('MoveLeft',  { device: 'keyboard', code: 'ArrowLeft' },  { device: 'keyboard', code: 'KeyA' });
    this.registerAction('MoveRight', { device: 'keyboard', code: 'ArrowRight' }, { device: 'keyboard', code: 'KeyD' });
    this.registerAction('MoveUp',    { device: 'keyboard', code: 'ArrowUp' },    { device: 'keyboard', code: 'KeyW' });
    this.registerAction('MoveDown',  { device: 'keyboard', code: 'ArrowDown' },  { device: 'keyboard', code: 'KeyS' });
    this.registerAction('Jump',      { device: 'keyboard', code: 'Space' },      { device: 'gamepad',  button: 0 });
    this.registerAction('Attack',    { device: 'keyboard', code: 'KeyZ' },       { device: 'mouse',    button: 0 }, { device: 'gamepad', button: 2 });
    this.registerAction('Dodge',     { device: 'keyboard', code: 'ShiftLeft' },  { device: 'gamepad',  button: 1 });
    this.registerAction('Interact',  { device: 'keyboard', code: 'KeyE' },       { device: 'gamepad',  button: 3 });
    this.registerAction('Pause',     { device: 'keyboard', code: 'Escape' },     { device: 'gamepad',  button: 9 });
  }

  update(): void {
    this.keyboard.update();
    this.mouse.update();
    this.gamepad.update();
  }

  private _checkBinding(b: ActionBinding, type: 'down' | 'pressed' | 'released'): boolean {
    if (b.device === 'keyboard') {
      switch (type) {
        case 'down':     return this.keyboard.isDown(b.code);
        case 'pressed':  return this.keyboard.isPressed(b.code);
        case 'released': return this.keyboard.isReleased(b.code);
      }
    }
    if (b.device === 'mouse') {
      switch (type) {
        case 'down':     return this.mouse.isDown(b.button);
        case 'pressed':  return this.mouse.isPressed(b.button);
        case 'released': return this.mouse.isReleased(b.button);
      }
    }
    if (b.device === 'gamepad') {
      const pi = b.padIndex ?? 0;
      switch (type) {
        case 'down':     return this.gamepad.isDown(b.button, pi);
        case 'pressed':  return this.gamepad.isPressed(b.button, pi);
        case 'released': return this.gamepad.isReleased(b.button, pi);
      }
    }
    return false;
  }

  isActionDown    (name: string): boolean { return this._anyBinding(name, 'down'); }
  isActionPressed (name: string): boolean { return this._anyBinding(name, 'pressed'); }
  isActionReleased(name: string): boolean { return this._anyBinding(name, 'released'); }

  private _anyBinding(name: string, type: 'down' | 'pressed' | 'released'): boolean {
    const bindings = this.actions.get(name);
    if (!bindings) return false;
    return bindings.some((b) => this._checkBinding(b, type));
  }

  /** Returns normalised 2D movement vector from WASD/arrows/left stick */
  getMovementVector(): { x: number; y: number } {
    let x = 0, y = 0;
    if (this.isActionDown('MoveLeft'))  x -= 1;
    if (this.isActionDown('MoveRight')) x += 1;
    if (this.isActionDown('MoveUp'))    y += 1;
    if (this.isActionDown('MoveDown'))  y -= 1;

    // Gamepad left stick
    const ax = this.gamepad.getAxis();
    x += ax.lx;
    y -= ax.ly;  // Y axis is inverted on gamepad

    // Normalise if diagonal
    const len = Math.sqrt(x * x + y * y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y };
  }

  destroy(): void {
    this.keyboard.destroy();
    this.mouse.destroy();
    this.gamepad.destroy();
  }
}
