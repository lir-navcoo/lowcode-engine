/**
 * @monbolc/lowcode-utils — Observable-lite tests (Phase A)
 *
 * The MobX-equivalent surface ali uses heavily, now ali-faithful
 * without MobX. The tests pin the contract that the ali-mirror's
 * subsequent phases (B, C, D) will rely on.
 */
import { describe, it, expect, vi } from 'vitest';
import { Observable, autorun, computed, reaction } from '../src/observable-lite';

describe('Observable<T> (Phase A ali-mirror)', () => {
  it('starts with the initial value', () => {
    const o = new Observable(0);
    expect(o.get()).toBe(0);
  });

  it('set() updates the value and emits change', () => {
    const o = new Observable(0);
    const seen: Array<{ value: number; prev: number }> = [];
    o.events.on('change', (e) => seen.push(e));
    o.set(1);
    expect(o.get()).toBe(1);
    expect(seen).toEqual([{ value: 1, prev: 0 }]);
  });

  it('set() is a no-op on identical values (Object.is)', () => {
    const o = new Observable(0);
    const seen: number[] = [];
    o.events.on('change', () => seen.push(1));
    o.set(0);
    expect(seen).toHaveLength(0);
  });

  it('update() applies the function and emits if changed', () => {
    const o = new Observable(5);
    o.update((n) => n * 2);
    expect(o.get()).toBe(10);
    o.update((n) => n); // no-op (same value)
    expect(o.get()).toBe(10);
  });

  it('supports non-primitive initial values (objects)', () => {
    const o = new Observable({ a: 1 });
    o.set({ a: 2 });
    expect(o.get().a).toBe(2);
  });
});

describe('autorun (Phase A ali-mirror)', () => {
  it('runs immediately on subscribe', () => {
    const fn = vi.fn();
    autorun(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('re-runs when an observed Observable changes', () => {
    const count = new Observable(0);
    const seen: number[] = [];
    autorun(() => seen.push(count.get()));
    expect(seen).toEqual([0]);
    count.set(1);
    expect(seen).toEqual([0, 1]);
    count.set(2);
    expect(seen).toEqual([0, 1, 2]);
  });

  it('re-tracks every rerun (ali-faithful autorun semantics)', () => {
    const a = new Observable(0);
    const b = new Observable(false);
    let last: { a: number; b: boolean } | null = null;
    autorun(() => {
      last = { a: a.get(), b: b.get() };
    });
    expect(last).toEqual({ a: 0, b: false });
    b.set(true);
    expect(last).toEqual({ a: 0, b: true });
    a.set(99);
    expect(last).toEqual({ a: 99, b: true });
  });

  it('disposer stops future re-runs', () => {
    const count = new Observable(0);
    const seen: number[] = [];
    const dispose = autorun(() => seen.push(count.get()));
    count.set(1);
    dispose();
    count.set(2);
    expect(seen).toEqual([0, 1]);
  });

  it('handles multiple subscribers independently', () => {
    const count = new Observable(0);
    const a: number[] = [];
    const b: number[] = [];
    autorun(() => a.push(count.get()));
    autorun(() => b.push(count.get()));
    count.set(1);
    expect(a).toEqual([0, 1]);
    expect(b).toEqual([0, 1]);
  });
});

describe('computed (Phase A ali-mirror)', () => {
  it('evaluates the getter on first read', () => {
    const a = new Observable(2);
    const b = new Observable(3);
    const sum = computed(() => a.get() + b.get());
    expect(sum.get()).toBe(5);
  });

  it('updates when a dependency changes', () => {
    const a = new Observable(2);
    const b = new Observable(3);
    const sum = computed(() => a.get() + b.get());
    expect(sum.get()).toBe(5);
    a.set(10);
    expect(sum.get()).toBe(13);
    b.set(20);
    expect(sum.get()).toBe(30);
  });

  it('chains correctly (computed-of-computed)', () => {
    const x = new Observable(2);
    const doubled = computed(() => x.get() * 2);
    const plusTen = computed(() => doubled.get() + 10);
    expect(plusTen.get()).toBe(14);
    x.set(5);
    expect(plusTen.get()).toBe(20);
  });
});

describe('reaction (Phase A ali-mirror)', () => {
  it('fires only when the tracked value changes', () => {
    const x = new Observable(0);
    const seen: Array<[number, number | undefined]> = [];
    reaction(() => x.get(), (next, prev) => seen.push([next, prev]));
    x.set(1);
    x.set(2);
    x.set(2); // no-op write
    expect(seen).toEqual([
      [1, 0],
      [2, 1],
    ]);
  });

  it('handles multi-value tracking', () => {
    const a = new Observable(1);
    const b = new Observable(2);
    const seen: Array<{ next: [number, number]; prev?: [number, number] }> = [];
    reaction(
      () => [a.get(), b.get()] as const,
      (next, prev) => seen.push({ next, prev }),
    );
    a.set(10);
    b.set(20);
    expect(seen).toEqual([
      { next: [10, 2], prev: [1, 2] },
      { next: [10, 20], prev: [10, 2] },
    ]);
  });

  it('disposer stops future effects', () => {
    const x = new Observable(0);
    const seen: number[] = [];
    const dispose = reaction(
      () => x.get(),
      (next) => seen.push(next),
    );
    x.set(1);
    dispose();
    x.set(2);
    expect(seen).toEqual([1]);
  });
});
