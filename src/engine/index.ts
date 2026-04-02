/**
 * Midnight Engine — v0.1.0
 * A complete 2D game engine for browser environments
 *
 * Architecture:
 *  ┌─────────────────────────────────────────┐
 *  │               Engine (orchestrator)      │
 *  │  GameLoop │ Renderer │ Scenes │ Input    │
 *  ├──────────────────────────────────────────┤
 *  │               ECS Core                   │
 *  │  World │ Entity │ Component │ System     │
 *  ├──────────────────────────────────────────┤
 *  │  Physics │ Animation │ Audio │ Scripting │
 *  └──────────────────────────────────────────┘
 */

// ── Core ──────────────────────────────────────
export { Engine }                from './core/Engine';
export type { EngineConfig, EngineStats } from './core/Engine';
export { GameLoop }              from './core/GameLoop';
export { EventEmitter, globalEvents } from './core/EventEmitter';
export { Logger, createLogger, LogLevel } from './core/Logger';

// ── Math ──────────────────────────────────────
export { Vec2 }       from './math/Vec2';
export { Vec3 }       from './math/Vec3';
export { Mat4 }       from './math/Mat4';
export { Transform }  from './math/Transform';
export { MathUtils }  from './math/MathUtils';

// ── ECS ───────────────────────────────────────
export { World }     from './ecs/World';
export { Entity }    from './ecs/Entity';
export { Component } from './ecs/Component';
export { System }    from './ecs/System';
export type { ComponentClass } from './ecs/Component';

// ── Rendering ─────────────────────────────────
export { Renderer }           from './rendering/Renderer';
export type { RendererConfig } from './rendering/Renderer';
export { Shader }             from './rendering/Shader';
export { Texture }            from './rendering/Texture';
export type { TextureOptions } from './rendering/Texture';
export { SpriteBatch }        from './rendering/SpriteBatch';
export type { SpriteDrawCall } from './rendering/SpriteBatch';
export { Camera }             from './rendering/Camera';
export { SpriteComponent }    from './rendering/SpriteComponent';
export { PostProcessStack }   from './rendering/PostProcessStack';
export type { PostFXSettings, } from './rendering/PostProcessStack';
export { DEFAULT_POST_FX }   from './rendering/PostProcessStack';

// ── Physics ───────────────────────────────────
export { RigidBody }          from './physics/RigidBody';
export type { BodyType }       from './physics/RigidBody';
export { Collider }           from './physics/Collider';
export type { ColliderShape }  from './physics/Collider';
export { PhysicsSystem }      from './physics/PhysicsSystem';
export type { PhysicsConfig }  from './physics/PhysicsSystem';
export { DEFAULT_PHYSICS_CONFIG } from './physics/PhysicsSystem';
export { SpatialHashGrid }    from './physics/BroadPhase';
export { NarrowPhase }        from './physics/NarrowPhase';
export type { CollisionManifold } from './physics/NarrowPhase';
export { CollisionResolver }  from './physics/CollisionResolver';

// ── Animation ─────────────────────────────────
export { AnimationClip }          from './animation/AnimationClip';
export type { AnimationFrame }     from './animation/AnimationClip';
export { AnimationStateMachine }  from './animation/AnimationStateMachine';
export type {
  AnimationState as AnimationStateConfig,
  StateTransition,
  TransitionCondition,
} from './animation/AnimationStateMachine';
export { AnimatorComponent }      from './animation/AnimatorComponent';
export { AnimationSystem }        from './animation/AnimationSystem';
export { BlendTree1D }            from './animation/BlendTree';
export type { BlendNode }         from './animation/BlendTree';

// ── Input ─────────────────────────────────────
export { InputManager }    from './input/InputManager';
export type { ActionBinding, InputAction } from './input/InputManager';
export { Keyboard }        from './input/Keyboard';
export { Mouse }           from './input/Mouse';
export { GamepadManager, GP_BUTTONS } from './input/Gamepad';

// ── Audio ─────────────────────────────────────
export { AudioEngine }          from './audio/AudioEngine';
export type { AudioSourceOptions, PlayHandle } from './audio/AudioEngine';
export { AudioSourceComponent } from './audio/AudioSourceComponent';
export { AudioSystem }         from './audio/AudioSystem';

// ── Gameplay ──────────────────────────────────
export { HealthComponent }  from './gameplay/HealthComponent';
export { CombatComponent }  from './gameplay/CombatComponent';
export type { DamageType, AttackData, StatusEffect } from './gameplay/CombatComponent';
export { CombatSystem }     from './gameplay/CombatSystem';
export type { DamageEvent } from './gameplay/CombatSystem';
export { StateMachine }     from './gameplay/StateMachine';
export type { State }       from './gameplay/StateMachine';

// ── Scripting ─────────────────────────────────
export { Script }           from './scripting/Script';
export type { ScriptDefinition } from './scripting/Script';
export { ScriptSystem }     from './scripting/ScriptSystem';
export { createScriptContext } from './scripting/ScriptAPI';
export type { ScriptContext }  from './scripting/ScriptAPI';

// ── Scene ─────────────────────────────────────
export { Scene }        from './scene/Scene';
export { SceneManager } from './scene/SceneManager';

// ── Assets ────────────────────────────────────
export { AssetLoader, globalAssets } from './assets/AssetLoader';
export type { AssetEntry, AssetType, LoadProgress } from './assets/AssetLoader';
