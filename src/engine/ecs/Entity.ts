// Entity — lightweight identifier that owns a bag of Components
import { Component, ComponentClass } from './Component';

let nextId = 1;

export class Entity {
  readonly id: number;
  name: string;
  active: boolean = true;
  private components = new Map<string, Component>();

  constructor(name = 'Entity') {
    this.id   = nextId++;
    this.name = name;
  }

  addComponent<T extends Component>(component: T): T {
    const key = (component.constructor as ComponentClass).TYPE;
    this.components.set(key, component);
    component.onAttach?.();
    return component;
  }

  getComponent<T extends Component>(cls: ComponentClass<T>): T | undefined {
    return this.components.get(cls.TYPE) as T | undefined;
  }

  requireComponent<T extends Component>(cls: ComponentClass<T>): T {
    const c = this.getComponent(cls);
    if (!c) throw new Error(`Entity "${this.name}" missing required component: ${cls.TYPE}`);
    return c;
  }

  hasComponent<T extends Component>(cls: ComponentClass<T>): boolean {
    return this.components.has(cls.TYPE);
  }

  removeComponent<T extends Component>(cls: ComponentClass<T>): boolean {
    const c = this.components.get(cls.TYPE);
    if (!c) return false;
    c.onDetach?.();
    this.components.delete(cls.TYPE);
    return true;
  }

  getAllComponents(): Component[] {
    return [...this.components.values()];
  }

  destroy(): void {
    this.active = false;
    this.components.forEach((c) => c.onDetach?.());
    this.components.clear();
  }
}
