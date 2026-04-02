// Gamepad — wraps the HTML5 Gamepad API with analog dead-zone handling
// Supports up to 4 controllers (standard mapping assumed)
export const GP_BUTTONS = {
  A: 0, B: 1, X: 2, Y: 3,
  LB: 4, RB: 5, LT: 6, RT: 7,
  SELECT: 8, START: 9,
  L_STICK: 10, R_STICK: 11,
  DPAD_UP: 12, DPAD_DOWN: 13, DPAD_LEFT: 14, DPAD_RIGHT: 15,
  HOME: 16,
} as const;

export class GamepadManager {
  private pads: (Gamepad | null)[] = [];
  private _prevButtons: boolean[][] = [];
  private deadzone: number;

  constructor(deadzone = 0.15) {
    this.deadzone = deadzone;
    window.addEventListener('gamepadconnected',    this._onConnect);
    window.addEventListener('gamepaddisconnected', this._onDisconnect);
  }

  /** Must be called every frame (Gamepad API is polling-based) */
  update(): void {
    const raw = navigator.getGamepads();
    for (let i = 0; i < 4; i++) {
      this.pads[i] = raw[i] ?? null;
      if (!this._prevButtons[i]) this._prevButtons[i] = [];
    }
  }

  private _snapshot(): void {
    for (let i = 0; i < 4; i++) {
      const pad = this.pads[i];
      if (!pad) continue;
      this._prevButtons[i] = pad.buttons.map((b) => b.pressed);
    }
  }

  isConnected(idx = 0): boolean { return !!this.pads[idx]; }

  isDown    (btn: number, idx = 0): boolean { return !!(this.pads[idx]?.buttons[btn]?.pressed); }
  isPressed (btn: number, idx = 0): boolean {
    return !!(this.pads[idx]?.buttons[btn]?.pressed) && !this._prevButtons[idx]?.[btn];
  }
  isReleased(btn: number, idx = 0): boolean {
    return !(this.pads[idx]?.buttons[btn]?.pressed) && !!this._prevButtons[idx]?.[btn];
  }

  getTrigger(trigger: 'LT' | 'RT', idx = 0): number {
    const btn = trigger === 'LT' ? GP_BUTTONS.LT : GP_BUTTONS.RT;
    return this.pads[idx]?.buttons[btn]?.value ?? 0;
  }

  getAxis(idx = 0): { lx: number; ly: number; rx: number; ry: number } {
    const pad = this.pads[idx];
    if (!pad) return { lx: 0, ly: 0, rx: 0, ry: 0 };
    const dz = this.deadzone;
    const apply = (v: number) => Math.abs(v) < dz ? 0 : v;
    return {
      lx: apply(pad.axes[0]),
      ly: apply(pad.axes[1]),
      rx: apply(pad.axes[2]),
      ry: apply(pad.axes[3]),
    };
  }

  /** Vibrate the controller (if supported) */
  vibrate(intensity: number, duration: number, idx = 0): void {
    const pad = this.pads[idx] as (Gamepad & { vibrationActuator?: { playEffect: (t: string, o: object) => void } });
    pad?.vibrationActuator?.playEffect('dual-rumble', {
      startDelay: 0, duration: duration * 1000,
      weakMagnitude: intensity, strongMagnitude: intensity,
    });
  }

  private _onConnect    = (e: GamepadEvent) => { this.pads[e.gamepad.index] = e.gamepad; };
  private _onDisconnect = (e: GamepadEvent) => { this.pads[e.gamepad.index] = null; };

  destroy(): void {
    window.removeEventListener('gamepadconnected',    this._onConnect);
    window.removeEventListener('gamepaddisconnected', this._onDisconnect);
  }
}
