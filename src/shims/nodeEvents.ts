type Listener = (...args: unknown[]) => void;

/**
 * Lightweight EventEmitter shim for browser environments. Only the subset
 * of APIs exercised by the AgentOS runtime are implemented.
 */
export class EventEmitter {
  private readonly listeners = new Map<string, Set<Listener>>();

  public on(event: string, listener: Listener): this {
    const bucket = this.listeners.get(event) ?? new Set<Listener>();
    bucket.add(listener);
    this.listeners.set(event, bucket);
    return this;
  }

  public off(event: string, listener: Listener): this {
    const bucket = this.listeners.get(event);
    bucket?.delete(listener);
    if (bucket && bucket.size === 0) {
      this.listeners.delete(event);
    }
    return this;
  }

  public once(event: string, listener: Listener): this {
    const wrapped: Listener = (...args) => {
      this.off(event, wrapped);
      listener(...args);
    };
    return this.on(event, wrapped);
  }

  public emit(event: string, ...args: unknown[]): boolean {
    const bucket = this.listeners.get(event);
    if (!bucket || bucket.size === 0) {
      return false;
    }
    for (const listener of Array.from(bucket)) {
      try {
        listener(...args);
      } catch (error) {
        console.error('[AgentOS Client] EventEmitter listener threw', error);
      }
    }
    return true;
  }

  public removeAllListeners(event?: string): this {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
    return this;
  }

  public listenerCount(event: string): number {
    return this.listeners.get(event)?.size ?? 0;
  }

  // Node compatibility aliases
  public removeListener(event: string, listener: Listener): this {
    return this.off(event, listener);
  }

  public addListener(event: string, listener: Listener): this {
    return this.on(event, listener);
  }
}

export default {
  EventEmitter,
};
