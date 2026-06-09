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

/** Slim port of `engineConfig.get(key)`. */
export function get(key: string): unknown {
  return _store.get(key);
}

/** Slim port of `engineConfig.set(key, value)`. */
export function set(key: string, value: unknown): void {
  _store.set(key, value);
}

/** Slim port of `engineConfig.has(key)`. */
export function has(key: string): boolean {
  return _store.has(key);
}

/** Slim port of `engineConfig.delete(key)`. */
export function remove(key: string): boolean {
  return _store.delete(key);
}

/** Clear all entries (for tests). */
export function clear(): void {
  _store.clear();
}

/** Ali-faithful `engineConfig` facade — namespace object. */
export const engineConfig = { get, set, has, remove, clear };
