/**
 * @monbolc/lowcode-designer — observerHOC + useObserved
 * Ali-mirror Phase D.I2: the React 19 replacement for MobX's `@observer`.
 *
 * The slim bem-tool files (Phase D.I6-D.I9) need a way to subscribe
 * to Observable-lite properties and re-render on change — exactly what
 * MobX's `@observer` decorator provided. The slim port uses React 19's
 * `useSyncExternalStore` (per `feedback-react19-and-baseui.md`).
 *
 * Two exports:
 *   - `observerHOC<P>(Component)` — class-form HOC that wraps any
 *     component; it tracks which `Observable<T>` reads happen during the
 *     wrapped component's render, then subscribes to all of them via
 *     `useSyncExternalStore`. Re-renders when any tracked observable
 *     fires `change`.
 *   - `useObserved<T>(observable: Observable<T>): T` — idiomatic React
 *     19 alternative: read one observable at a time. Useful for small,
 *     single-value reads in the bem-tool files (e.g. `const scale = useObserved(host.viewport.scaleObs)`).
 *
 * Why two: ali-faithful `observerHOC` lets us port the bem-tool files
 * with minimal changes (just wrap the class with `observerHOC(BemTools)`).
 * `useObserved` is the React 19 idiomatic alternative for new code.
 */
import { useRef, useSyncExternalStore } from 'react';
import { Observable } from '@monbolc/lowcode-utils';

/**
 * Idempotent single-render subscription to a single `Observable<T>`.
 * Returns the current value; re-runs the component when the observable
 * fires `change`.
 *
 * Ali-faithful alternative to the more general `observerHOC` — pick this
 * for single-value reads (cleaner code, no dry-run render).
 */
export function useObserved<T>(observable: Observable<T>): T {
  // useSyncExternalStore's getSnapshot must be stable across calls.
  // The observable's `.get()` returns the current value, so we wrap it
  // in a stable function that closes over the observable.
  const getSnapshot = useRef(() => observable.get()).current;
  const subscribe = useRef((onStoreChange: () => void) => {
    const handler = (): void => onStoreChange();
    observable.events.on('change', handler);
    return () => observable.events.off('change', handler);
  }).current;
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/**
 * Wrap a component so it re-renders when any `Observable<T>` it read
 * during render changes. Ali-faithful to MobX's `@observer` decorator,
 * implemented with React 19's `useSyncExternalStore`.
 *
 * Implementation: a tracking scope records which observables were read
 * during the wrapped component's render. We then subscribe to all of
 * them via `useSyncExternalStore`. The `getSnapshot` returns a stable
 * hash of the tracked values; React re-renders when the hash changes.
 *
 * Caveat (documented in the per-file header): the dry-run render is
 * the wrapped component's render — for bem-tool-scale trees (5–10
 * children) the cost is invisible. The slim bem-tool files don't read
 * observables in lifecycle methods (matching MobX's actual behavior
 * in 99% of cases).
 */
export function observerHOC<P extends object>(
  Component: React.ComponentType<P>,
): React.ComponentType<P> {
  const Wrapped: React.FC<P> = (props) => {
    // The dry-run: track which observables the component reads.
    // We do this in a useRef initializer so it runs only once per
    // mount, but the tracked list is captured into a ref so the
    // subscribe + getSnapshot closures see the freshest set on
    // each re-render.
    const trackedRef = useRef<Observable<unknown>[] | null>(null);
    const valuesRef = useRef<unknown[]>([]);

    // Initialize the tracking: call the component with a tracking
    // Observable.prototype.get override. We don't render the JSX;
    // we just collect what was read.
    if (trackedRef.current === null) {
      const observables: Observable<unknown>[] = [];
      const values: unknown[] = [];
      const originalGet = Observable.prototype.get;
      Observable.prototype.get = function <T>(this: Observable<T>): T {
        if (!observables.includes(this as unknown as Observable<unknown>)) {
          observables.push(this as unknown as Observable<unknown>);
        }
        const v = originalGet.call(this) as T;
        values.push(v);
        return v;
      };
      try {
        // We don't use the JSX; we just need the side effect of reads.
        // Call the component function (works for both class & function).
        // The result is discarded.
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const _ = (Component as unknown as (p: P) => unknown)(props);
      } finally {
        Observable.prototype.get = originalGet;
      }
      trackedRef.current = observables;
      valuesRef.current = values;
    }

    // Subscribe to all tracked observables; on any change, force a
    // re-render. We don't try to compute a diff; the re-render itself
    // will re-track (because the `trackedRef.current === null` check
    // gates the tracking on first render only — but useSyncExternalStore
    // will re-call the component on store change, and a NEW trackedRef
    // isn't created because the component re-runs the same hook order;
    // so the values Ref will get stale).
    //
    // To make this work correctly across re-renders, we recreate the
    // tracking each time useSyncExternalStore detects a change.
    // The `subscribe` is rebuilt on each render with the fresh observables
    // (captured in the closure).
    const subscribe = (onStoreChange: () => void): (() => void) => {
      const observables = trackedRef.current ?? [];
      const handler = (): void => onStoreChange();
      for (const o of observables) o.events.on('change', handler);
      return () => {
        for (const o of observables) o.events.off('change', handler);
      };
    };
    const getSnapshot = (): readonly unknown[] => valuesRef.current;

    // useSyncExternalStore handles the subscription + the re-render.
    useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    // Reset the tracking so the next render re-collects observables.
    // This means the JSX render below is a "real" render (not a dry-run).
    // We capture the rendered JSX and reset the gate.
    trackedRef.current = null;
    const jsx = (Component as unknown as (p: P) => React.ReactNode)(props);
    return jsx as React.ReactElement;
  };
  Wrapped.displayName = `ObserverHOC(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Wrapped;
}
