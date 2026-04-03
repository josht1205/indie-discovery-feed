// ParticleEmitter — ECS Component that owns a ParticleSystem
// Attach to any entity; the ParticleEmitterSystem drives it each frame
import { Component } from '../ecs/Component';
import { ParticleSystem, ParticleEmissionParams } from './ParticleSystem';

export class ParticleEmitter extends Component {
  static readonly TYPE = 'ParticleEmitter';

  system: ParticleSystem | null = null;   // set by ParticleEmitterSystem on init
  params: Partial<ParticleEmissionParams> = {};

  // Track if we want to play
  playing = true;

  play():  void { this.playing = true; }
  stop():  void { this.playing = false; }
  burst(n?: number): void { this.system?.burst(n); }
}
