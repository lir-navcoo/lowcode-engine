/**
 * @monbolc/lowcode-designer — setting/setting-helpers
 *
 * Local slim re-implementations of small `@alilc/lowcode-utils` helpers
 * the setting tree uses. None of these exist in @monbolc scope; the slim
 * port keeps them as 1-2 line duck-type checks (plus a minimal cloneDeep)
 * so consumers don't need a new dependency.
 */

/** Ali-faithful re-implementation of `@alilc/lowcode-utils.isCustomView`. */
export function isCustomView(x: unknown): x is { componentName: 'CustomView'; [key: string]: unknown } {
  return !!x && typeof x === 'object' && (x as { componentName?: string }).componentName === 'CustomView';
}

/** Ali-faithful re-implementation of `@alilc/lowcode-utils.isDynamicSetter`. */
export function isDynamicSetter(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

/**
 * Minimal deep-clone. Ali uses lodash's `cloneDeep`; sapu has no lodash
 * dep. The slim port handles the common case (plain object, array, primitive)
 * — sufficient for `getHotValue` (which clones the prop value before
 * pushing through `transducer.toHot`). Cycle-safe via the visited set.
 */
export function cloneDeep<T>(v: T): T {
  return cloneDeepInner(v, new WeakMap()) as T;
}

function cloneDeepInner(v: unknown, visited: WeakMap<object, unknown>): unknown {
  if (v === null || typeof v !== 'object') return v;
  if (visited.has(v as object)) return visited.get(v as object);
  if (Array.isArray(v)) {
    const out: unknown[] = [];
    visited.set(v as object, out);
    for (const item of v) out.push(cloneDeepInner(item, visited));
    return out;
  }
  // Plain object
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) {
    // Non-plain object (class instance, etc.) — return as-is. Sufficient
    // for the setting-tree use case; full cycle-safe cloning is out of
    // scope (the slim `Node` / `Prop` objects don't need cloning).
    return v;
  }
  const out: Record<string, unknown> = {};
  visited.set(v as object, out);
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    out[k] = cloneDeepInner(val, visited);
  }
  return out;
}
