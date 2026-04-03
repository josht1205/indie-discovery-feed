// VisibilityNotifier — Godot VisibilityNotifier2D equivalent
// Fires events when an entity enters/exits the camera viewport
// Used to: pause off-screen AI, stop off-screen particles, stream assets
import { Component }     from '../ecs/Component';
import { FrustumCuller } from './FrustumCuller';
import { Transform }     from '../math/Transform';
import { System }        from '../ecs/System';
import { Camera }        from './Camera';
import { createLogger }  from '../core/Logger';

const log = createLogger('VisibilityNotifier');

export class VisibilityNotifier extends Component {
  static readonly TYPE = 'VisibilityNotifier';

  // Half-extents for visibility bounds (world units)
  halfW = 32;
  halfH = 32;

  isVisible     = false;
  wasVisible    = false;

  // Callbacks fired on state change
  onBecameVisible?:   () => void;
  onBecameInvisible?: () => void;
}

export class VisibilityNotifierSystem extends System {
  priority = 95;

  private culler = new FrustumCuller();

  override update(_dt: number): void {
    // Update culler from active camera
    const camEntity = this.world.queryFirst(Camera);
    if (!camEntity) return;
    const cam = camEntity.requireComponent(Camera);
    this.culler.updateFromCamera(cam);

    const entities = this.world.query(VisibilityNotifier, Transform);
    for (const e of entities) {
      const vis = e.requireComponent(VisibilityNotifier);
      const tf  = e.requireComponent(Transform);

      vis.wasVisible = vis.isVisible;
      vis.isVisible  = this.culler.isVisibleSprite(
        tf.position.x, tf.position.y, vis.halfW, vis.halfH,
      );

      if (vis.isVisible && !vis.wasVisible) {
        vis.onBecameVisible?.();
        this.world.events.emit('visibility:enter', e);
      } else if (!vis.isVisible && vis.wasVisible) {
        vis.onBecameInvisible?.();
        this.world.events.emit('visibility:exit', e);
      }
    }
  }
}
