import { describe, it, expect } from 'vitest';
import {
  isPlainObject,
  isNil,
  deepClone,
  isEqual,
  merge,
  pick,
  omit,
} from '../src/object';

describe('isPlainObject', () => {
  it('returns true for plain objects', () => {
    expect(isPlainObject({})).toBe(true);
    expect(isPlainObject({ a: 1 })).toBe(true);
    expect(isPlainObject(Object.create(null))).toBe(true);
  });
  it('returns false for non-plain values', () => {
    expect(isPlainObject(null)).toBe(false);
    expect(isPlainObject(undefined)).toBe(false);
    expect(isPlainObject([])).toBe(false);
    expect(isPlainObject('s')).toBe(false);
    expect(isPlainObject(42)).toBe(false);
    expect(isPlainObject(new Date())).toBe(false);
    expect(isPlainObject(new Map())).toBe(false);
  });
  it('returns false for class instances', () => {
    class Foo {}
    expect(isPlainObject(new Foo())).toBe(false);
  });
});

describe('isNil', () => {
  it('handles null and undefined', () => {
    expect(isNil(null)).toBe(true);
    expect(isNil(undefined)).toBe(true);
  });
  it('returns false for everything else', () => {
    expect(isNil(0)).toBe(false);
    expect(isNil('')).toBe(false);
    expect(isNil(false)).toBe(false);
    expect(isNil(NaN)).toBe(false);
    expect(isNil({})).toBe(false);
  });
});

describe('deepClone', () => {
  it('clones primitives and returns them as-is', () => {
    expect(deepClone(42)).toBe(42);
    expect(deepClone('x')).toBe('x');
    expect(deepClone(null)).toBe(null);
    expect(deepClone(undefined)).toBe(undefined);
    expect(Number.isNaN(deepClone(NaN))).toBe(true);
  });
  it('clones nested plain objects', () => {
    const a = { x: 1, nested: { y: [2, 3, { z: 4 }] } };
    const b = deepClone(a);
    expect(b).toEqual(a);
    expect(b).not.toBe(a);
    expect(b.nested).not.toBe(a.nested);
    expect(b.nested.y).not.toBe(a.nested.y);
    expect(b.nested.y[2]).not.toBe(a.nested.y[2]);
  });
  it('clones Date and RegExp by value', () => {
    const d = new Date('2024-01-01');
    const c = deepClone(d);
    expect(c).not.toBe(d);
    expect(c.getTime()).toBe(d.getTime());

    const r = /abc/gi;
    const rc = deepClone(r);
    expect(rc).not.toBe(r);
    expect(rc.source).toBe('abc');
    expect(rc.flags).toBe('gi');
  });
  it('clones Map and Set', () => {
    const m = new Map<string, number>([['a', 1], ['b', 2]]);
    const mc = deepClone(m);
    expect(mc).not.toBe(m);
    expect(mc.get('a')).toBe(1);

    const s = new Set([1, 2, 3]);
    const sc = deepClone(s);
    expect(sc).not.toBe(s);
    expect(sc.size).toBe(3);
  });
  it('returns class instances as-is (cloning them is usually wrong)', () => {
    class Foo { constructor(public x = 1) {} }
    const f = new Foo(5);
    expect(deepClone(f)).toBe(f);
  });
  it('deepClone(undefined) returns undefined', () => {
    expect(deepClone(undefined)).toBe(undefined);
  });
});

describe('isEqual', () => {
  it('strict equality for primitives', () => {
    expect(isEqual(1, 1)).toBe(true);
    expect(isEqual('a', 'a')).toBe(true);
    expect(isEqual(1, '1')).toBe(false);
    expect(isEqual(null, null)).toBe(true);
    expect(isEqual(null, undefined)).toBe(false);
  });
  it('treats NaN as equal to NaN', () => {
    expect(isEqual(NaN, NaN)).toBe(true);
  });
  it('compares Date by time', () => {
    expect(isEqual(new Date(0), new Date(0))).toBe(true);
    expect(isEqual(new Date(0), new Date(1))).toBe(false);
  });
  it('compares RegExp by source+flags', () => {
    expect(isEqual(/a/g, /a/g)).toBe(true);
    expect(isEqual(/a/g, /a/i)).toBe(false);
    expect(isEqual(/a/g, /b/g)).toBe(false);
  });
  it('compares arrays element-wise', () => {
    expect(isEqual([1, 2, 3], [1, 2, 3])).toBe(true);
    expect(isEqual([1, 2], [1, 2, 3])).toBe(false);
    expect(isEqual([1, 2, 3], [1, 2, 4])).toBe(false);
  });
  it('compares plain objects deeply', () => {
    expect(isEqual({ a: 1, b: { c: 2 } }, { a: 1, b: { c: 2 } })).toBe(true);
    expect(isEqual({ a: 1 }, { a: 2 })).toBe(false);
    expect(isEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false);
    expect(isEqual({ a: 1 }, { b: 1 })).toBe(false);
  });
  it('handles mixed array/object', () => {
    expect(isEqual([1, 2], { 0: 1, 1: 2, length: 2 })).toBe(false);
  });
});

describe('merge', () => {
  it('shallow-merges multiple sources into target', () => {
    expect(merge({ a: 1 }, { b: 2 }, { c: 3 })).toEqual({ a: 1, b: 2, c: 3 });
  });
  it('later sources override earlier', () => {
    expect(merge({ a: 1 }, { a: 2 })).toEqual({ a: 2 });
  });
  it('does not mutate inputs', () => {
    const target = { a: 1 };
    const out = merge(target, { b: 2 });
    expect(target).toEqual({ a: 1 });
    expect(out).toEqual({ a: 1, b: 2 });
  });
});

describe('pick', () => {
  it('picks specified keys', () => {
    expect(pick({ a: 1, b: 2, c: 3 }, ['a', 'c'])).toEqual({ a: 1, c: 3 });
  });
  it('omits non-existent keys', () => {
    expect(pick({ a: 1 }, ['a', 'b' as never])).toEqual({ a: 1 });
  });
});

describe('omit', () => {
  it('omits specified keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });
});
