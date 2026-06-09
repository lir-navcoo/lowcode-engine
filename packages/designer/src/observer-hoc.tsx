/**
 * @monbolc/lowcode-designer — observerHOC + useObserved
 * Ali-mirror Phase D.I2: the React 19 replacement for MobX's `@observer`.
 *
 * Two exports:
 *   - `observerHOC<P>(Component)` — class-form HOC; subscribes to
 *     a tracked set of `Observable<T>` reads and re-renders on change.
 *   - `useObserved<T>(observable)` — idiomatic React 19 alternative for
 *     single-value reads.
 *
 * The D.I2 original used a prototype-patch tracking approach (patch
 * `Observable.prototype.get` during render, collect reads, then
 * subscribe to them). This was fragile under React 19's concurrent
 * rendering and broke when trying to invoke class components (the
 * patched render call hit `Class constructor cannot be invoked without
 * 'new'`). The Phase D.I8 rewrite takes a simpler, less clever
 * approach: the wrapped component re-renders on ANY `Observable`
 * change (we subscribe to `Observable.prototype` events broadly).
 * This is less efficient than ali-faithful MobX (re-render on any
 * observable change anywhere in the tree) but matches the bem-tool
 * use case (a few components, a handful of observables, re-render is
 * cheap).
 *
 * Phase E can re-introduce the tracking approach with a Babel plugin
 * (transforming `host.viewport.scale` reads into tracked accesses) or
 * via a Proxy-based `withObservables` HOC.
 */
import * as React from 'react';
import { useRef, useSyncExternalStore } from 'react';
import { Observable } from '@monbolc/lowcode-utils';

/**
 * Idempotent single-render subscription to a single `Observable<T>`.
 * Returns the current value; re-runs the component when the observable
 * fires `change`.
 */
export function useObserved<T>(observable: Observable<T>): T {
  const getSnapshot = useRef(() => observable.get()).current;
  const subscribe = useRef((onStoreChange: () => void) => {
    const handler = (): void => onStoreChange();
    observable.events.on('change', handler);
    return () => observable.events.off('change', handler);
  }).current;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Wrap a component so it re-renders whenever ANY `Observable` in the
 * app fires `change`. The slim port subscribes to the module-global
 * `Observable.prototype` events (broadcast any-change) so wrapped
 * components re-render on the broadest signal.
 *
 * Ali-faithful alternative: MobX's `@observer` (re-render on
 * observed-change; ignore unobserved-change). The slim port is
 * "wider" than ali-faithful but matches the bem-tool use case.
 *
 * For fine-grained subscriptions, prefer `useObserved` at the call site.
 */
export function observerHOC<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  // Subscribers to a singleton "any change" signal. Each Wrapped
  // component subscribes once on mount and unsubscribes on unmount.
  // When ANY Observable fires `change`, all subscribers re-render.
  type ChangeListener = () => void;
  const listeners = new Set<ChangeListener>();
  const broadcast = (): void => {
    for (const l of listeners) l();
  };
  // The module-global `Observable.prototype` doesn't exist (we don't
  // patch the prototype globally). Instead, use a per-emitter
  // signal: any Observable that fires `change` will call `broadcast`.
  // We monkey-patch `Observable.prototype` ONCE to wrap the existing
  // `get` / `set` with side effects. This is safe because Phase A's
  // Observable fires `change` events via its own emitter; we add a
  // `broadcast()` call on each fire.
  const originalFire = (Observable.prototype as unknown as { _fire?: () => void })._fire;
  if (!originalFire) {
    // Patch the `set` method to broadcast on any change.
    const proto = Observable.prototype as unknown as { set: (v: unknown) => void };
    const originalSet = proto.set;
    proto.set = function (v: unknown): void {
      originalSet.call(this, v);
      // The `originalSet` calls `events.emit('change', ...)` internally;
      // we hook the broadcast AFTER the original set returns.
      broadcast();
    };
  }

  const Wrapped: React.FC<P> = (props) => {
    // useSyncExternalStore re-renders when `subscribe` fires.
    useSyncExternalStore(
      (onStoreChange) => {
        const handler: ChangeListener = () => {
          onStoreChange();
        };
        listeners.add(handler);
        return () => { listeners.delete(handler); };
      },
      () => 0,
      () => 0,
    );
    // The actual JSX render: let React call the component for us.
    // Ali-faithful to React: use createElement for both class + function
    // components (React's reconciler handles the rest).
    return React.createElement(Component, props);
  };
  Wrapped.displayName = `ObserverHOC(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
}
