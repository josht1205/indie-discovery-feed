// AnimationStateMachine — controls clip transitions via conditions
// Supports parameters (float, bool, trigger) and transition rules
import { AnimationClip } from './AnimationClip';

export type ParamType = 'float' | 'bool' | 'trigger' | 'int';

export interface AnimParam {
  type:  ParamType;
  value: number | boolean;
}

export type ConditionOp = '==' | '!=' | '>' | '<' | '>=' | '<=' | 'trigger';

export interface TransitionCondition {
  param:  string;
  op:     ConditionOp;
  value?: number | boolean;
}

export interface StateTransition {
  toState:    string;
  conditions: TransitionCondition[];
  // If exitTime > 0, only check after this normalised playback position [0..1]
  exitTime?:  number;
  duration?:  number;  // blend duration (seconds); 0 = instant
}

export interface AnimationState {
  name:        string;
  clip:        AnimationClip;
  transitions: StateTransition[];
  speed?:      number;  // playback multiplier (default 1)
}

export interface AnimationStateResult {
  clip:         AnimationClip;
  frame:        number;
  uvX: number; uvY: number; uvW: number; uvH: number;
  normalizedTime: number;
  finished:     boolean;
}

export class AnimationStateMachine {
  private states = new Map<string, AnimationState>();
  private params = new Map<string, AnimParam>();

  currentStateName = '';
  private timer    = 0;
  private frameIdx = 0;

  get currentState(): AnimationState | undefined {
    return this.states.get(this.currentStateName);
  }

  addState(state: AnimationState): this {
    this.states.set(state.name, state);
    return this;
  }

  setEntry(name: string): this {
    this.currentStateName = name;
    this.timer = 0; this.frameIdx = 0;
    return this;
  }

  // Parameter setters
  setFloat  (name: string, v: number):  void { this.params.set(name, { type: 'float',   value: v }); }
  setBool   (name: string, v: boolean): void { this.params.set(name, { type: 'bool',    value: v }); }
  setInt    (name: string, v: number):  void { this.params.set(name, { type: 'int',     value: v }); }
  setTrigger(name: string):             void { this.params.set(name, { type: 'trigger', value: true }); }
  getFloat  (name: string): number  { return (this.params.get(name)?.value as number) ?? 0; }
  getBool   (name: string): boolean { return (this.params.get(name)?.value as boolean) ?? false; }

  update(dt: number): AnimationStateResult {
    const state = this.currentState;
    if (!state) {
      return { clip: null!, frame: 0, uvX: 0, uvY: 0, uvW: 1, uvH: 1, normalizedTime: 0, finished: false };
    }

    const speed = state.speed ?? 1;
    this.timer += dt * speed;

    const clip = state.clip;
    const total = clip.totalDuration;
    let normalized = total > 0 ? this.timer / total : 0;
    let finished = false;

    if (clip.loop) {
      this.timer %= total;
      normalized = this.timer / total;
    } else {
      if (this.timer >= total) {
        this.timer = total;
        normalized = 1;
        finished = true;
      }
    }

    // Advance frame based on timer
    let accum = 0;
    this.frameIdx = 0;
    for (let i = 0; i < clip.frames.length; i++) {
      accum += clip.frames[i].duration;
      if (this.timer <= accum) { this.frameIdx = i; break; }
      this.frameIdx = clip.frames.length - 1;
    }

    // Check transitions
    for (const tr of state.transitions) {
      if (tr.exitTime !== undefined && normalized < tr.exitTime) continue;
      if (this._checkConditions(tr.conditions)) {
        this._transition(tr.toState);
        break;
      }
    }

    // Reset triggers after evaluation
    for (const [name, p] of this.params) {
      if (p.type === 'trigger' && p.value === true) p.value = false;
    }

    const frame = clip.frames[this.frameIdx];
    return {
      clip,
      frame: this.frameIdx,
      uvX: frame.uvX, uvY: frame.uvY, uvW: frame.uvW, uvH: frame.uvH,
      normalizedTime: normalized,
      finished,
    };
  }

  private _transition(toState: string): void {
    if (!this.states.has(toState)) return;
    this.currentStateName = toState;
    this.timer = 0;
    this.frameIdx = 0;
  }

  private _checkConditions(conditions: TransitionCondition[]): boolean {
    for (const cond of conditions) {
      const p = this.params.get(cond.param);
      if (!p) return false;
      if (cond.op === 'trigger') { if (!p.value) return false; continue; }
      const a = p.value as number;
      const b = cond.value as number;
      switch (cond.op) {
        case '==': if (a !== b) return false; break;
        case '!=': if (a === b) return false; break;
        case '>':  if (a <= b)  return false; break;
        case '<':  if (a >= b)  return false; break;
        case '>=': if (a < b)   return false; break;
        case '<=': if (a > b)   return false; break;
      }
    }
    return conditions.length > 0;
  }
}
