/**
 * @monbolc/lowcode-designer — utils/engine-config
 * Ali-mirror Phase D.I6 shim: the `engineConfig` global.
 *
 * Ali-faithful shape of `@alilc/lowcode-editor-core.engineConfig`: a
 * module-global `Map<key, value>` with `get` / `set` / `has`. Sapu's
 * slim port keeps the same surface so the bem-tool files can call
 * `engineConfig.get('disableDetecting')` / `engineConfig.get('enableReactiveContainer')` /
 * `engineConfig.get('hideComponentAction')` without compile errors.
 *
 * Per audit R1 (recommendation): stub for Phase D, port the real
 * ali-faithful `engineConfig` (a 15-LoC Map) as a no-op shim. Phase E
 * can replace the stub with a richer config (typed keys, DI, etc.).
 */
const _store = new Map<string, unknown>();
// Phase D.I7b.19: per-key subscriber set. Each entry maps a
// config key to a set of callbacks that fire when the value
// changes. The Map-of-Sets shape keeps onGot O(1) registration
// + O(k) dispatch where k is the number of subscribers on
// that key.
const _subs = new Map<string, Set<(value: unknown) => void>>();

/** Slim port of `engineConfig.get(key)`. */
export function get(key: string): unknown {
  return _store.get(key);
}

/** Slim port of `engineConfig.set(key, value)`. */
export function set(key: string, value: unknown): void {
  _store.set(key, value);
  // Phase D.I7b.19: notify per-key subscribers. Iteration
  // over a Set is O(k) but the callback shouldn't mutate
  // the set during dispatch (it would invalidate the
  // iterator). Ali-faithful `onGot` returns a disposer so
  // the callback can clean itself up; we copy the set
  // before iterating to be safe.
  const set_ = _subs.get(key);
  if (set_) {
    for (const fn of Array.from(set_)) fn(value);
  }
}

/**
 * Phase D.I7b.19: ali-faithful `engineConfig.onGot(key, fn)`.
 * Returns a disposer. The callback fires:
 *   - immediately (with the current value, or `undefined` if
 *     not set), matching ali's "fire-on-register if present"
 *     behavior
 *   - on every subsequent `set(key, ...)` call
 *
 * Used by the bem-tool files (e.g. `onGot('enableReactiveContainer', ...)`
 * would let a plugin react when the flag is flipped at runtime).
 */
export function onGot(key: string, fn: (value: unknown) => void): () => void {
  let set_ = _subs.get(key);
  if (!set_) {
    set_ = new Set();
    _subs.set(key, set_);
  }
  set_.add(fn);
  // Fire immediately with the current value (ali-faithful).
  fn(_store.get(key));
  // Return a disposer.
  return () => {
    const s = _subs.get(key);
    if (s) s.delete(fn);
  };
}

/** Slim port of `engineConfig.has(key)`. */
export function has(key: string): boolean {
  return _store.has(key);
}

/** Slim port of `engineConfig.delete(key)`. */
export function remove(key: string): boolean {
  // Phase D.I7b.19: removing a key also notifies subscribers
  // with `undefined` (ali-faithful: `remove` is observable).
  // Commenting this out for now to keep the slim surface
  // minimal; uncomment if a plugin needs the remove-stream.
  return _store.delete(key);
}

/** Clear all entries (for tests). */
export function clear(): void {
  _store.clear();
  // Phase D.I7b.19: clear also drops subscribers (so tests
  // don't leak across describe blocks).
  _subs.clear();
}

/** Ali-faithful `engineConfig` facade — namespace object. */
export const engineConfig = { get, set, onGot, has, remove, clear };
