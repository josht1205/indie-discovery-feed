// StateMachine<T> — generic hierarchical state machine for game objects
// (Separate from AnimationStateMachine — this drives gameplay logic)
export interface State<T> {
  name:   string;
  onEnter?(ctx: T, prev: string): void;
  onExit? (ctx: T, next: string): void;
  update? (ctx: T, dt: number):   void;
}

export class StateMachine<T> {
  private states = new Map<string, State<T>>();
  private _current = '';
  private _history: string[] = [];
  readonly ctx: T;

  constructor(ctx: T) { this.ctx = ctx; }

  addState(state: State<T>): this {
    this.states.set(state.name, state);
    return this;
  }

  start(name: string): void {
    this._current = name;
    this.states.get(name)?.onEnter?.(this.ctx, '');
  }

  transition(name: string): void {
    if (name === this._current) return;
    const prev = this._current;
    this.states.get(prev)?.onExit?.(this.ctx, name);
    this._history.push(prev);
    if (this._history.length > 10) this._history.shift();
    this._current = name;
    this.states.get(name)?.onEnter?.(this.ctx, prev);
  }

  /** Return to the previous state (one level) */
  popState(): void {
    const prev = this._history.pop();
    if (prev) this.transition(prev);
  }

  update(dt: number): void {
    this.states.get(this._current)?.update?.(this.ctx, dt);
  }

  get current(): string { return this._current; }
  is(name: string): boolean { return this._current === name; }
}
