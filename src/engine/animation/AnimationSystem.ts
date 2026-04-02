// AnimationSystem — drives all AnimatorComponents and syncs UV to SpriteComponent
import { System } from '../ecs/System';
import { AnimatorComponent } from './AnimatorComponent';
import { SpriteComponent } from '../rendering/SpriteComponent';
import { Transform } from '../math/Transform';

export class AnimationSystem extends System {
  priority = 5;

  override update(dt: number): void {
    const entities = this.world.query(AnimatorComponent);
    for (const e of entities) {
      const animator = e.requireComponent(AnimatorComponent);
      if (!animator.enabled) continue;

      const result = animator.stateMachine.update(dt * animator.speed);

      animator.currentUVX = result.uvX;
      animator.currentUVY = result.uvY;
      animator.currentUVW = result.uvW;
      animator.currentUVH = result.uvH;

      // Write to sprite if present
      const sprite = e.getComponent(SpriteComponent);
      if (sprite) {
        sprite.uvX = result.uvX;
        sprite.uvY = result.uvY;
        sprite.uvW = result.uvW;
        sprite.uvH = result.uvH;
      }
    }
  }
}
