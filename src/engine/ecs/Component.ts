// Component — base class for all data containers attached to entities
// Extend this to create domain-specific components (Transform, RigidBody, Sprite, etc.)
export abstract class Component {
  /** Each concrete class should define a unique static TYPE string */
  static readonly TYPE: string = 'Component';
  enabled = true;

  // Called when component is attached to an entity
  onAttach?(): void;
  // Called when component is detached or entity is destroyed
  onDetach?(): void;
}

// Helper type to extract the component type string
export type ComponentClass<T extends Component = Component> = {
  new(...args: unknown[]): T;
  readonly TYPE: string;
};
