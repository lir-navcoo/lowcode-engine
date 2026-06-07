/**
 * @monbolc/lowcode-utils — typed event emitter
 *
 * A minimal, type-safe pub/sub used by the engine for plugin communication
 * and lifecycle hooks. Heavier emitters (e.g. mitt, tiny-emitter) are
 * dependencies we don't need to take on.
 */

import type { Primitive, PlainObject } from './types';

export type EventHandler<T = unknown> = (payload: T) => void;

export type EventMap = Record<string, unknown>;

interface EmitterEntry {
  once: boolean;
  fn: EventHandler;
}

/**
 * Strongly-typed event bus.
 *
 * ```ts
 * const bus = new Emitter<{ ready: void; change: { id: string } }>();
 * bus.on('change', ({ id }) => console.log('changed', id));
 * bus.emit('change', { id: 'n_1' });
 * bus.off('change');
 * ```
 */
export class Emitter<E extends EventMap = EventMap> {
  private listeners = new Map<keyof E, EmitterEntry[]>();

  on<K extends keyof E>(event: K, handler: EventHandler<E[K]>): () => void {
    return this.add(event, handler as EventHandler, false);
  }

  once<K extends keyof E>(event: K, handler: EventHandler<E[K]>): () => void {
    return this.add(event, handler as EventHandler, true);
  }

  off<K extends keyof E>(event: K, handler?: EventHandler<E[K]>): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    if (!handler) {
      this.listeners.delete(event);
      return;
    }
    const idx = arr.findIndex((e) => e.fn === handler);
    if (idx >= 0) arr.splice(idx, 1);
  }

  emit<K extends keyof E>(event: K, payload: E[K]): void {
    const arr = this.listeners.get(event);
    if (!arr) return;
    // Iterate over a copy so once-handlers can remove themselves safely.
    for (const entry of [...arr]) {
      try {
        entry.fn(payload);
      } catch (err) {
        // Swallow handler errors so a bad listener doesn't break the bus.
        if (typeof console !== 'undefined' && console.error) {
          console.error(`[Emitter] handler for "${String(event)}" threw:`, err);
        }
      }
      if (entry.once) this.off(event, entry.fn as EventHandler<E[K]>);
    }
  }

  removeAllListeners(event?: keyof E): void {
    if (event === undefined) {
      this.listeners.clear();
    } else {
      this.listeners.delete(event);
    }
  }

  listenerCount<K extends keyof E>(event: K): number {
    return this.listeners.get(event)?.length ?? 0;
  }

  private add<K extends keyof E>(
    event: K,
    handler: EventHandler<E[K]>,
    once: boolean,
  ): () => void {
    let arr = this.listeners.get(event);
    if (!arr) {
      arr = [];
      this.listeners.set(event, arr);
    }
    const entry: EmitterEntry = { once, fn: handler as EventHandler };
    arr.push(entry);
    return () => this.off(event, handler);
  }
}
