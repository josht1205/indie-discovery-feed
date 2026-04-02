// Script — component holding TypeScript/JavaScript game-logic closures
// Provides Unity-like lifecycle hooks: onStart, onUpdate, onFixedUpdate, onDestroy
import { Component }    from '../ecs/Component';
import { ScriptContext } from './ScriptAPI';

export type ScriptLifecycleFn = (ctx: ScriptContext) => void;

export interface ScriptDefinition {
  name:           string;
  onStart?:       ScriptLifecycleFn;
  onUpdate?:      ScriptLifecycleFn;
  onFixedUpdate?: ScriptLifecycleFn;
  onLateUpdate?:  ScriptLifecycleFn;
  onDestroy?:     ScriptLifecycleFn;
  // Collision events
  onCollisionEnter?(ctx: ScriptContext, other: import('../ecs/Entity').Entity): void;
  onCollisionExit? (ctx: ScriptContext, other: import('../ecs/Entity').Entity): void;
  // Custom properties the script can use for state
  [key: string]: unknown;
}

export class Script extends Component {
  static readonly TYPE = 'Script';

  definitions: ScriptDefinition[] = [];

  // Runtime state storage per script definition
  private state: Map<string, Record<string, unknown>> = new Map();

  private _started = false;
  get started() { return this._started; }
  set started(v: boolean) { this._started = v; }

  addScript(def: ScriptDefinition): this {
    this.definitions.push(def);
    this.state.set(def.name, {});
    return this;
  }

  /** Get (or lazily create) mutable state bag for a script */
  getState(scriptName: string): Record<string, unknown> {
    if (!this.state.has(scriptName)) this.state.set(scriptName, {});
    return this.state.get(scriptName)!;
  }
}
