// ScriptSystem — executes Script lifecycle methods each frame
import { System }             from '../ecs/System';
import { Script }             from './Script';
import { createScriptContext } from './ScriptAPI';
import { InputManager }       from '../input/InputManager';
import { createLogger }       from '../core/Logger';
import { Entity }             from '../ecs/Entity';

const log = createLogger('ScriptSystem');

export class ScriptSystem extends System {
  priority = 50;
  private input!: InputManager;

  setInput(input: InputManager): void { this.input = input; }

  override fixedUpdate(dt: number): void {
    const entities = this.world.query(Script);
    for (const e of entities) {
      const script = e.requireComponent(Script);
      this._runLifecycle(e, script, dt, 'onFixedUpdate');
    }
  }

  override update(dt: number): void {
    const entities = this.world.query(Script);
    for (const e of entities) {
      const script = e.requireComponent(Script);

      // Call onStart once
      if (!script.started) {
        script.started = true;
        this._runLifecycle(e, script, dt, 'onStart');
      }

      this._runLifecycle(e, script, dt, 'onUpdate');
    }
  }

  override lateUpdate(dt: number): void {
    const entities = this.world.query(Script);
    for (const e of entities) {
      const script = e.requireComponent(Script);
      this._runLifecycle(e, script, dt, 'onLateUpdate');
    }
  }

  private _runLifecycle(
    entity: Entity,
    script: Script,
    dt: number,
    hook: 'onStart' | 'onUpdate' | 'onFixedUpdate' | 'onLateUpdate',
  ): void {
    const ctx = createScriptContext(entity, this.world, this.input, dt);
    for (const def of script.definitions) {
      try {
        def[hook]?.(ctx);
      } catch (err) {
        log.error('Script "%s" %s threw: %o', def.name, hook, err);
      }
    }
  }
}
