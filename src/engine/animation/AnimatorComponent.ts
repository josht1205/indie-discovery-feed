// AnimatorComponent — drives the AnimationStateMachine and writes UV rects to SpriteComponent
import { Component } from '../ecs/Component';
import { AnimationStateMachine } from './AnimationStateMachine';

export class AnimatorComponent extends Component {
  static readonly TYPE = 'AnimatorComponent';

  stateMachine: AnimationStateMachine = new AnimationStateMachine();
  speed = 1;

  // Last evaluated UV (written to SpriteComponent each frame by AnimationSystem)
  currentUVX = 0; currentUVY = 0; currentUVW = 1; currentUVH = 1;

  // Convenience accessors forwarded to state machine
  setFloat  (name: string, v: number):  void { this.stateMachine.setFloat(name, v); }
  setBool   (name: string, v: boolean): void { this.stateMachine.setBool(name, v); }
  setTrigger(name: string):             void { this.stateMachine.setTrigger(name); }
  play      (state: string):            void { this.stateMachine.setEntry(state); }
}
