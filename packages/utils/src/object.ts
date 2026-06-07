/**
 * @monbolc/lowcode-utils — object utilities
 *
 * Deep-clone, shallow/deep equality, plain-object detection, and shallow-merge.
 * No external dependencies; targets ES2020.
 */

import type { PlainObject, Nil } from './types';

/**
 * True if the value is a plain object (not a class instance, not an array, not null).
 */
export function isPlainObject(value: unknown): value is PlainObject {
  if (value === null || typeof value !== 'object') return false;
  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * True if the value is null or undefined.
 */
export function isNil(value: unknown): value is Nil {
  return value === null || value === undefined;
}

/**
 * Deep clone. Handles plain objects, arrays, primitives, Date, RegExp, Map, Set.
 * Falls back to structuredClone when available (Node 17+, modern browsers).
 */
export function deepClone<T>(value: T): T {
  if (value === null || typeof value !== 'object') return value;
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  if (value instanceof Date) return new Date(value.getTime()) as unknown as T;
  if (value instanceof RegExp) {
    return new RegExp(value.source, value.flags) as unknown as T;
  }
  if (value instanceof Map) {
    const out = new Map();
    for (const [k, v] of value.entries()) out.set(deepClone(k), deepClone(v));
    return out as unknown as T;
  }
  if (value instanceof Set) {
    const out = new Set();
    for (const v of value) out.add(deepClone(v));
    return out as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => deepClone(item)) as unknown as T;
  }
  if (isPlainObject(value)) {
    const out: PlainObject = {};
    for (const key of Object.keys(value)) {
      out[key] = deepClone((value as PlainObject)[key]);
    }
    return out as T;
  }
  // Class instances: return as-is (cloning them is usually wrong)
  return value;
}

/**
 * Deep equality. Compares own enumerable properties recursively.
 * Special-cases Date (by time) and RegExp (by source+flags).
 */
export function isEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
    return a !== a && b !== b; // NaN
  }
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a instanceof RegExp && b instanceof RegExp) {
    return a.source === b.source && a.flags === b.flags;
  }
  if (Array.isArray(a)) {
    if (!Array.isArray(b)) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!isEqual(a[i], b[i])) return false;
    }
    return true;
  }
  if (Array.isArray(b)) return false;
  if (isPlainObject(a) && isPlainObject(b)) {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false;
      if (!isEqual((a as PlainObject)[key], (b as PlainObject)[key])) return false;
    }
    return true;
  }
  return false;
}

/**
 * Shallow merge. Later sources override earlier ones. Does not mutate inputs.
 */
export function merge<T extends PlainObject, U extends PlainObject>(
  target: T,
  ...sources: U[]
): T & U {
  const out: PlainObject = { ...target };
  for (const src of sources) {
    for (const key of Object.keys(src)) {
      out[key] = (src as PlainObject)[key];
    }
  }
  return out as T & U;
}

/**
 * Pick a subset of keys from an object.
 */
export function pick<T extends PlainObject, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, k)) {
      out[k] = obj[k];
    }
  }
  return out;
}

/**
 * Omit a set of keys from an object.
 */
export function omit<T extends PlainObject, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const out = { ...obj };
  for (const k of keys) {
    delete out[k];
  }
  return out;
}
