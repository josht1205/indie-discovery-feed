// EventEmitter — typed pub/sub bus used throughout the engine
export type EventHandler<T = unknown> = (data: T) => void;

export class EventEmitter {
  private listeners: Map<string, Set<EventHandler<unknown>>> = new Map();

  on<T>(event: string, handler: EventHandler<T>): () => void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(handler as EventHandler<unknown>);
    return () => this.off(event, handler);
  }

  once<T>(event: string, handler: EventHandler<T>): void {
    const wrapper: EventHandler<T> = (data) => {
      handler(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  off<T>(event: string, handler: EventHandler<T>): void {
    this.listeners.get(event)?.delete(handler as EventHandler<unknown>);
  }

  emit<T>(event: string, data?: T): void {
    this.listeners.get(event)?.forEach((h) => h(data as unknown));
  }

  removeAllListeners(event?: string): void {
    if (event) this.listeners.delete(event);
    else this.listeners.clear();
  }
}

export const globalEvents = new EventEmitter();
