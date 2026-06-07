import { describe, it, expect } from 'vitest';
import { parsePath, getByPath, setByPath, deleteByPath } from '../src/path';

describe('parsePath', () => {
  it('splits dot paths', () => {
    expect(parsePath('a.b.c')).toEqual(['a', 'b', 'c']);
  });
  it('converts [n] notation to .n', () => {
    expect(parsePath('a.b[0].c')).toEqual(['a', 'b', '0', 'c']);
  });
  it('returns [] for empty input', () => {
    expect(parsePath('')).toEqual([]);
  });
  it('filters empty segments', () => {
    expect(parsePath('a..b')).toEqual(['a', 'b']);
  });
});

describe('getByPath', () => {
  const obj = {
    a: 1,
    b: { c: 2, d: { e: 3 } },
    arr: [{ x: 1 }, { x: 2 }],
    nul: null,
  };
  it('reads nested fields', () => {
    expect(getByPath(obj, 'a')).toBe(1);
    expect(getByPath(obj, 'b.c')).toBe(2);
    expect(getByPath(obj, 'b.d.e')).toBe(3);
  });
  it('reads array indices', () => {
    expect(getByPath(obj, 'arr.0.x')).toBe(1);
    expect(getByPath(obj, 'arr[1].x')).toBe(2);
  });
  it('returns defaultValue for missing path', () => {
    expect(getByPath(obj, 'nope', 'fallback')).toBe('fallback');
    expect(getByPath(obj, 'a.b.c.d', 'fallback')).toBe('fallback');
  });
  it('returns defaultValue when traversing through null', () => {
    expect(getByPath(obj, 'nul.x', 'fallback')).toBe('fallback');
  });
  it('returns defaultValue for nil root', () => {
    expect(getByPath(null, 'a', 'fallback')).toBe('fallback');
    expect(getByPath(undefined, 'a', 'fallback')).toBe('fallback');
  });
  it('returns undefined when value is explicitly undefined and no default', () => {
    expect(getByPath({ a: undefined }, 'a')).toBeUndefined();
    expect(getByPath({ a: undefined }, 'a', 'd')).toBe('d');
  });
});

describe('setByPath', () => {
  it('sets nested values creating intermediates', () => {
    const obj: Record<string, unknown> = {};
    setByPath(obj, 'a.b.c', 42);
    expect(obj).toEqual({ a: { b: { c: 42 } } });
  });
  it('overwrites existing values', () => {
    const obj: Record<string, unknown> = { a: { b: 1 } };
    setByPath(obj, 'a.b', 2);
    expect(obj).toEqual({ a: { b: 2 } });
  });
  it('handles array indices', () => {
    const obj: Record<string, unknown> = { arr: [] };
    setByPath(obj, 'arr[0].x', 99);
    expect(obj).toEqual({ arr: [{ x: 99 }] });
  });
  it('returns the same object reference', () => {
    const obj: Record<string, unknown> = {};
    const out = setByPath(obj, 'a', 1);
    expect(out).toBe(obj);
  });
});

describe('deleteByPath', () => {
  it('deletes nested keys', () => {
    const obj: Record<string, unknown> = { a: { b: { c: 1, d: 2 } } };
    expect(deleteByPath(obj, 'a.b.c')).toBe(true);
    expect(obj).toEqual({ a: { b: { d: 2 } } });
  });
  it('returns false for non-existent path', () => {
    expect(deleteByPath({}, 'a.b.c')).toBe(false);
    expect(deleteByPath({ a: 1 }, 'a.b.c')).toBe(false);
  });
  it('returns false for empty path', () => {
    expect(deleteByPath({}, '')).toBe(false);
  });
});
