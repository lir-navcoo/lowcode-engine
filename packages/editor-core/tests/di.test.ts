import { describe, it, expect } from 'vitest';
import { DIContainer } from '../src/di';

describe('DIContainer', () => {
  it('register + get singleton', async () => {
    const c = new DIContainer();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return { v: calls };
    };
    c.register<{ v: number }>(factory, factory);
    const a = await c.get(factory);
    const b = await c.get(factory);
    expect(a).toBe(b);
    expect(calls).toBe(1);
  });

  it('transient scope re-builds each time', async () => {
    const c = new DIContainer();
    let calls = 0;
    const factory = () => {
      calls += 1;
      return { v: calls };
    };
    c.register<{ v: number }>(factory, factory, 'transient');
    const a = await c.get(factory);
    const b = await c.get(factory);
    expect(a).not.toBe(b);
    expect(calls).toBe(2);
  });

  it('rejects duplicate registration', () => {
    const c = new DIContainer();
    const f = () => 1;
    c.register<number>(f, f);
    expect(() => c.register<number>(f, f)).toThrow();
  });

  it('peek returns undefined before first get, then cached instance after', async () => {
    const c = new DIContainer();
    const factory = () => ({ x: 1 });
    c.register<{ x: number }>(factory, factory);
    expect(c.peek(factory)).toBeUndefined();
    const inst = await c.get(factory);
    expect(c.peek(factory)).toBe(inst);
  });

  it('get throws for unregistered', async () => {
    const c = new DIContainer();
    await expect(c.get(() => 1)).rejects.toThrow();
  });

  it('has / size / clear work', async () => {
    const c = new DIContainer();
    const f1 = () => 1;
    const f2 = () => 2;
    c.register<number>(f1, f1);
    c.register<number>(f2, f2);
    expect(c.has(f1)).toBe(true);
    expect(c.has(f2)).toBe(true);
    expect(c.size()).toBe(2);
    c.clear();
    expect(c.size()).toBe(0);
    expect(c.has(f1)).toBe(false);
  });

  it('factory can call get() to resolve other services', async () => {
    const c = new DIContainer();
    const a = () => 'A';
    const b = () => Promise.resolve('B');
    c.register<string>(a, a);
    c.register<string>(b, b);
    const aggregatorFactory = async (inner: DIContainer) => {
      const va = await inner.get(a);
      const vb = await inner.get(b);
      return `${va}+${vb}`;
    };
    c.register<string>(aggregatorFactory, aggregatorFactory);
    const out = await c.get(aggregatorFactory);
    expect(out).toBe('A+B');
  });
});
