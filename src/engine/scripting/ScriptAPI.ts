// ScriptAPI — sandboxed object passed to script closures
// Provides typed access to engine systems without exposing internals
import { World }         from '../ecs/World';
import { Entity }        from '../ecs/Entity';
import { Transform }     from '../math/Transform';
import { RigidBody }     from '../physics/RigidBody';
import { HealthComponent } from '../gameplay/HealthComponent';
import { CombatComponent } from '../gameplay/CombatComponent';
import { AnimatorComponent } from '../animation/AnimatorComponent';
import { AudioSourceComponent } from '../audio/AudioSourceComponent';
import { InputManager }  from '../input/InputManager';
import { Vec2 }          from '../math/Vec2';
import { MathUtils }     from '../math/MathUtils';

export interface ScriptContext {
  entity: Entity;
  world:  World;
  input:  InputManager;
  dt:     number;

  // Convenience accessors
  transform:  Transform | undefined;
  body:       RigidBody | undefined;
  health:     HealthComponent | undefined;
  combat:     CombatComponent | undefined;
  animator:   AnimatorComponent | undefined;
  audio:      AudioSourceComponent | undefined;

  // Utility
  vec2:  (x: number, y: number) => Vec2;
  math:  typeof MathUtils;

  // Entity helpers
  spawn:   (name: string) => Entity;
  destroy: (e?: Entity)   => void;
  find:    (name: string) => Entity | undefined;

  // Event helpers
  emit:    (event: string, data?: unknown) => void;
  on:      (event: string, handler: (data: unknown) => void) => () => void;
}

export function createScriptContext(
  entity: Entity,
  world:  World,
  input:  InputManager,
  dt:     number,
): ScriptContext {
  return {
    entity, world, input, dt,
    get transform() { return entity.getComponent(Transform); },
    get body()      { return entity.getComponent(RigidBody); },
    get health()    { return entity.getComponent(HealthComponent); },
    get combat()    { return entity.getComponent(CombatComponent); },
    get animator()  { return entity.getComponent(AnimatorComponent); },
    get audio()     { return entity.getComponent(AudioSourceComponent); },
    vec2: (x, y) => new Vec2(x, y),
    math: MathUtils,
    spawn:   (name) => world.createEntity(name),
    destroy: (e)    => world.destroyEntity((e ?? entity).id),
    find:    (name) => world.findByName(name),
    emit:    (ev, d) => world.events.emit(ev, d),
    on:      (ev, h) => world.events.on(ev, h),
  };
}
