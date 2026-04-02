// Keyboard — tracks key state with pressed/held/released detection
export type KeyCode = string;  // KeyboardEvent.code values e.g. 'KeyA', 'Space', 'ArrowLeft'

export class Keyboard {
  private current  = new Set<KeyCode>();
  private previous = new Set<KeyCode>();
  private _toAdd    = new Set<KeyCode>();
  private _toRemove = new Set<KeyCode>();

  constructor() {
    window.addEventListener('keydown', this._onDown);
    window.addEventListener('keyup',   this._onUp);
  }

  /** Must be called once per fixed frame to swap state buffers */
  update(): void {
    this.previous = new Set(this.current);
    for (const k of this._toAdd)    this.current.add(k);
    for (const k of this._toRemove) this.current.delete(k);
    this._toAdd.clear();
    this._toRemove.clear();
  }

  isDown(code: KeyCode):     boolean { return this.current.has(code); }
  isPressed(code: KeyCode):  boolean { return this.current.has(code) && !this.previous.has(code); }
  isReleased(code: KeyCode): boolean { return !this.current.has(code) && this.previous.has(code); }

  private _onDown = (e: KeyboardEvent): void => {
    this._toAdd.add(e.code);
    this._toRemove.delete(e.code);
  };
  private _onUp   = (e: KeyboardEvent): void => {
    this._toRemove.add(e.code);
    this._toAdd.delete(e.code);
  };

  destroy(): void {
    window.removeEventListener('keydown', this._onDown);
    window.removeEventListener('keyup',   this._onUp);
  }
}
