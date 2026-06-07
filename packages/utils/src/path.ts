/**
 * @monbolc/lowcode-utils — path utilities
 *
 * Get/set values at dotted paths inside nested objects. Used by the data
 * binding layer to read `(this.user.name)` expressions in component props.
 */

import { isNil, isPlainObject } from './object';

/**
 * Convert a dotted path string to an array of segments.
 * `a.b[0].c` → `['a', 'b', '0', 'c']`
 */
export function parsePath(path: string): string[] {
  if (!path) return [];
  return path
    .replace(/\[(\d+)\]/g, '.$1') // a[0] -> a.0
    .split('.')
    .filter(Boolean);
}

/**
 * Get a value at the given dotted path. Returns `defaultValue` if any segment is missing.
 */
export function getByPath(obj: unknown, path: string, defaultValue?: unknown): unknown {
  if (isNil(obj)) return defaultValue;
  const segments = parsePath(path);
  let current: unknown = obj;
  for (const seg of segments) {
    if (isNil(current)) return defaultValue;
    if (isPlainObject(current)) {
      current = (current as Record<string, unknown>)[seg];
    } else if (Array.isArray(current) && /^\d+$/.test(seg)) {
      current = current[Number(seg)];
    } else {
      return defaultValue;
    }
  }
  return current === undefined ? defaultValue : current;
}

/**
 * Set a value at the given dotted path, creating intermediate objects
 * (or arrays, when the next segment is numeric) as needed. Returns the
 * (mutated) input object.
 *
 *   setByPath({}, 'a.b.c', 1)         // { a: { b: { c: 1 } } }
 *   setByPath({}, 'arr[0].x', 9)      // { arr: [{ x: 9 }] }
 */
export function setByPath<T extends object>(obj: T, path: string, value: unknown): T {
  const segments = parsePath(path);
  if (segments.length === 0) return obj;

  // Walk all but the last segment, descending or creating containers.
  let current: Record<string, unknown> = obj as Record<string, unknown>;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const next = current[seg];
    if (isPlainObject(next) || Array.isArray(next)) {
      current = next as Record<string, unknown>;
    } else {
      // Create a new container. Use an array if the *next* segment is numeric.
      const nextSegIsNumeric = /^\d+$/.test(segments[i + 1]);
      const created: Record<string, unknown> = nextSegIsNumeric ? [] : {};
      current[seg] = created;
      current = created;
    }
  }

  // Set the leaf.
  const last = segments[segments.length - 1];
  if (/^\d+$/.test(last) && Array.isArray(current)) {
    (current as unknown as unknown[])[Number(last)] = value;
  } else {
    current[last] = value;
  }
  return obj;
}

/**
 * Delete a value at the given dotted path. Returns true if anything was removed.
 */
export function deleteByPath(obj: object, path: string): boolean {
  const segments = parsePath(path);
  if (segments.length === 0) return false;
  let current: unknown = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    if (!isPlainObject(current)) return false;
    current = (current as Record<string, unknown>)[segments[i]];
    if (isNil(current)) return false;
  }
  if (!isPlainObject(current)) return false;
  const last = segments[segments.length - 1];
  if (Object.prototype.hasOwnProperty.call(current, last)) {
    delete (current as Record<string, unknown>)[last];
    return true;
  }
  return false;
}
