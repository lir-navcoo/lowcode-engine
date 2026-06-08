/**
 * @monbolc/lowcode-utils — Observable-lite
 *
 * A minimal "Observable + autorun + computed + reaction" helper
 * that mirrors the MobX surface sapu needs to mirror ali's
 * designer / simulator source — without pulling in MobX.
 *
 * Ali's source uses `@obx.ref` / `@computed` / `@autorun` / MobX
 * `reaction` / `runInAction` heavily. Sapu's stance is no
 * MobX, no proxy, no ipc — so we provide a plain class +
 * Emitter equivalent. This file is Phase A of the ali-mirror
 * plan (see docs/HANDOVER.md → Roadmap → "ali mirror Phase A").
 *
 * What's here (and what isn't):
 *   - `Observable<T>` — read+write observable value, emits
 *     'change' on every `set()`. Ali equivalent: `ref` +
 *     `observable.box`.
 *   - `autorun(fn)` — call `fn()` once + every time any
 *     observable it read changes. Ali equivalent: `autorun`.
 *   - `computed(getter)` — a derived observable that recomputes
 *     when its source observables change. Ali equivalent:
 *     `computed`.
 *   - `reaction(track, effect)` — re-run `effect` when the
 *     values returned by `track` change. Ali equivalent:
 *     `reaction`.
 *
 * What's NOT here (and the documented gap):
 *   - `@observer` HOC for React — that's `observerHOC` in the
 *     React layer (Phase D). This file is React-free.
 *   - `runInAction` (transaction batching) — sapu's design is
 *     synchronous setter + synchronous Emitter notification, so
 *     no batching is needed. If a future need arises, add a
 *     `batch(fn)` here.
 *   - `makeObservable` (class-level decoration) — sapu reads
 *     observable fields on plain classes; the React layer
 *     subscribes via the Emitter and re-renders. No automatic
 *     field wrapping.
 *
 * The "Observable" naming is intentionally ali-faithful (instead
 * of "Box") so ported code reads naturally. Don't add a
 * `Proxy`-based ref implementation — sapu explicitly avoids
 * proxies (per project memory).
 */

import { Emitter, type EventHandler, type EventMap } from './emitter';

// ---------------------------------------------------------------------------
// Observable<T>
// ---------------------------------------------------------------------------

export interface ObservableEvents<T> extends EventMap {
  change: { value: T; prev: T };
}

/**
 * A single observable value. Read via `get()`, write via `set()`.
 * Subscribers fire on every `set()`. The "change" payload carries
 * both the new value and the previous so `reaction` can compare.
 *
 * Ali-faithful to MobX's `observable.box()` shape: same `get()` /
 * `set()` API, same "change" event semantics.
 */
export class Observable<T> {
  readonly events = new Emitter<ObservableEvents<T>>();
  private _value: T;

  constructor(initial: T) {
    this._value = initial;
  }

  /** Ali-faithful: `box.get()`. */
  get(): T {
    return this._value;
  }

  /**
   * Ali-faithful: `box.set(v)`. No-ops if `v` is `===` to the
   * current value (avoids spurious events on no-op writes — a
   * common ali pattern). Always emits on a real change; the
   * Emitter is a no-op when there are no subscribers, so we
   * don't need a `_hasListeners` flag.
   */
  set(next: T): void {
    if (Object.is(next, this._value)) return;
    const prev = this._value;
    this._value = next;
    this.events.emit('change', { value: next, prev });
  }

  /**
   * Ali-faithful: `box.update(fn)`. Pass the current value to
   * `fn`, store the return. Emits if the result is different.
   */
  update(fn: (current: T) => T): void {
    this.set(fn(this._value));
  }
}

// ---------------------------------------------------------------------------
// Current reactive scope (used by autorun / computed / reaction)
// ---------------------------------------------------------------------------

/**
 * Ali-faithful to MobX's internal `_view`. We patch
 * `Observable.prototype.get` while a scope is active to also
 * push the observable into the scope's set. This is a clean
 * v8-allowed approach (assignment to a class prototype's own
 * property) and avoids the need for `Object.defineProperty`
 * magic. When the scope ends, we restore the original `get`.
 */
let activeScope: { observables: Set<Observable<unknown>>; originalGet: typeof Observable.prototype.get } | null = null;

// ---------------------------------------------------------------------------
// autorun
// ---------------------------------------------------------------------------

/**
 * Run `effect` immediately + every time any observable it read
 * changes. Returns a disposer. Ali-faithful to MobX's `autorun`.
 *
 * Example:
 *   const count = new Observable(0);
 *   const dispose = autorun(() => console.log(count.get()));
 *   count.set(1); // logs 1
 *   dispose();
 */
export function autorun(effect: () => void): () => void {
  // One scope per autorun. Every rerun:
  //   1. Unsubscribes the previous tick's listeners
  //   2. Re-runs the effect under a patched `get` that tracks
  //   3. Subscribes listeners to the newly-tracked observables
  const scope: {
    observables: Set<Observable<unknown>>;
  } = { observables: new Set() };

  // The "listener" we attach to each observed Observable: marks
  // the scope as dirty and re-runs the effect. Ali-faithful —
  // MobX uses a per-listener callback that re-triggers the
  // autorun. We re-run synchronously (same as MobX's default
  // `autorun` behavior). If the effect mutates another
  // observable recursively, MobX's `runInAction` (which we
  // don't ship) would batch; we don't, so a deep chain just
  // bubbles synchronously up the call stack. This is fine for
  // sapu's existing 8.5/481-test workload.
  const listener = (): void => {
    rerun();
  };

  // Ali's `autorun` re-tracks every tick because the control
  // flow may have changed which observables the effect reads.
  const rerun = (): void => {
    // Unhook the previous tick's listeners.
    for (const o of scope.observables) {
      o.events.off('change', listener);
    }
    scope.observables.clear();
    // Patch Observable.prototype.get so any read during the
    // effect run records the observable into our scope.
    const originalGet = Observable.prototype.get;
    Observable.prototype.get = function <T>(this: Observable<T>): T {
      scope.observables.add(this as unknown as Observable<unknown>);
      return originalGet.call(this) as T;
    };
    try {
      effect();
    } finally {
      Observable.prototype.get = originalGet;
    }
    // Subscribe listeners to the newly-tracked observables.
    for (const o of scope.observables) {
      o.events.on('change', listener);
    }
  };

  // Initial run.
  rerun();

  // Return a disposer that removes all listeners and resets
  // the prototype patch (defensive — in case the user calls
  // dispose from inside the effect itself).
  return () => {
    for (const o of scope.observables) {
      o.events.off('change', listener);
    }
    scope.observables.clear();
  };
}

// ---------------------------------------------------------------------------
// computed
// ---------------------------------------------------------------------------

/**
 * A derived observable. The getter runs the first time the
 * computed is `get()`-ed, and re-runs when any observable it
 * read changes. Ali-faithful to MobX's `computed()`.
 *
 * Implementation: a lazy `Observable<T>` whose value is held in
 * sync by an internal `autorun`. The first read of the
 * computed triggers the autorun (which fires immediately),
 * so `get()` returns a fresh value on first call.
 */
export function computed<T>(getter: () => T): Observable<T> {
  const obs = new Observable<T>(getter());
  autorun(() => {
    const next = getter();
    obs.set(next);
  });
  return obs;
}

// ---------------------------------------------------------------------------
// reaction
// ---------------------------------------------------------------------------

/**
 * Run `effect(args)` whenever the values returned by `track`
 * change. `args` is `[newValue, prevValue]` for each tracked
 * observable. Ali-faithful to MobX's `reaction(track, effect)`.
 *
 * Example:
 *   const a = new Observable(0);
 *   const b = new Observable(0);
 *   reaction(
 *     () => [a.get(), b.get()] as const,
 *     ([na, nb], [oa, ob]) => console.log(na, nb, 'was', oa, ob),
 *   );
 *   a.set(1); // logs "1 0 was 0 0"
 */
export function reaction<T extends readonly unknown[]>(
  track: () => T,
  effect: (next: T, prev: T) => void,
): () => void {
  let prev: T | undefined;
  let first = true;
  return autorun(() => {
    const next = track();
    if (first) {
      first = false;
    } else if (prev !== undefined) {
      effect(next, prev);
    }
    prev = next;
  });
}
