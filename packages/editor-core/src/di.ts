/**
 * @monbolc/lowcode-editor-core — DIContainer
 *
 * A tiny, type-friendly dependency injection container. Each entry is
 * keyed by a constructor / factory function. Resolve is async because
 * a factory may itself call `get(...)` to satisfy its own deps.
 *
 * Why a custom container instead of InversifyJS / tsyringe?
 * - The editor's DI surface is small (a few dozen services at most).
 * - We want zero runtime deps and a TS-friendly API.
 * - We do not need scoping / child containers / aspect interception.
 */

import { uid } from '@monbolc/lowcode-utils';

export type Factory<T> = (container: DIContainer) => T | Promise<T>;

interface Registration<T> {
  /** Cached instance, populated after first resolve. */
  instance?: T;
  /** Factory that builds the instance. */
  factory: Factory<T>;
  /** Singleton vs transient. */
  scope: 'singleton' | 'transient';
}

export class DIContainer {
  private readonly services = new Map<Factory<unknown>, Registration<unknown>>();
  private readonly id = uid('di');

  /**
   * Register a service. The `ctor` is the lookup key — call `get(ctor)`
   * to retrieve the instance. The `factory` builds the instance.
   */
  register<T>(ctor: Factory<T>, factory: Factory<T>, scope: 'singleton' | 'transient' = 'singleton'): void {
    if (this.services.has(ctor as Factory<unknown>)) {
      throw new Error(`[DIContainer:${this.id}] service already registered for this ctor`);
    }
    this.services.set(ctor as Factory<unknown>, { factory, scope });
  }

  /**
   * Resolve a service. If a singleton was already built, returns the
   * cached instance; otherwise calls the factory and caches.
   */
  async get<T>(ctor: Factory<T>): Promise<T> {
    const reg = this.services.get(ctor as Factory<unknown>);
    if (!reg) {
      throw new Error(`[DIContainer:${this.id}] no service registered for this ctor`);
    }
    if (reg.instance !== undefined && reg.scope === 'singleton') {
      return reg.instance as T;
    }
    const instance = await (reg.factory as Factory<T>)(this);
    if (reg.scope === 'singleton') reg.instance = instance;
    return instance;
  }

  /**
   * Synchronous lookup. Returns undefined if the service is not yet built
   * (or not registered at all). Useful for non-async consumers.
   */
  peek<T>(ctor: Factory<T>): T | undefined {
    const reg = this.services.get(ctor as Factory<unknown>);
    return reg?.instance as T | undefined;
  }

  /** True if a factory is registered for this key. */
  has<T>(ctor: Factory<T>): boolean {
    return this.services.has(ctor as Factory<unknown>);
  }

  /** Drop all registrations and cached instances. */
  clear(): void {
    this.services.clear();
  }

  /** Number of registered services. */
  size(): number {
    return this.services.size;
  }
}
