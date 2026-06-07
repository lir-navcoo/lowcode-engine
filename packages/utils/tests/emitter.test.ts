import { describe, it, expect, vi } from 'vitest';
import { Emitter } from '../src/emitter';

describe('Emitter', () => {
  it('calls on-handler when event is emitted', () => {
    const bus = new Emitter<{ ping: number }>();
    const fn = vi.fn();
    bus.on('ping', fn);
    bus.emit('ping', 1);
    bus.emit('ping', 2);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 1);
  });

  it('once-handler runs exactly one time', () => {
    const bus = new Emitter<{ go: void }>();
    const fn = vi.fn();
    bus.once('go', fn);
    bus.emit('go', undefined);
    bus.emit('go', undefined);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('off removes a specific handler', () => {
    const bus = new Emitter<{ e: number }>();
    const a = vi.fn();
    const b = vi.fn();
    bus.on('e', a);
    bus.on('e', b);
    bus.off('e', a);
    bus.emit('e', 1);
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it('off with no handler removes all handlers for an event', () => {
    const bus = new Emitter<{ e: number }>();
    const fn = vi.fn();
    bus.on('e', fn);
    bus.off('e');
    bus.emit('e', 1);
    expect(fn).not.toHaveBeenCalled();
  });

  it('removeAllListeners wipes the entire bus', () => {
    const bus = new Emitter<{ a: void; b: void }>();
    const fnA = vi.fn();
    const fnB = vi.fn();
    bus.on('a', fnA);
    bus.on('b', fnB);
    bus.removeAllListeners();
    bus.emit('a', undefined);
    bus.emit('b', undefined);
    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).not.toHaveBeenCalled();
  });

  it('removeAllListeners with event name clears only that event', () => {
    const bus = new Emitter<{ a: void; b: void }>();
    const fnA = vi.fn();
    const fnB = vi.fn();
    bus.on('a', fnA);
    bus.on('b', fnB);
    bus.removeAllListeners('a');
    bus.emit('a', undefined);
    bus.emit('b', undefined);
    expect(fnA).not.toHaveBeenCalled();
    expect(fnB).toHaveBeenCalledTimes(1);
  });

  it('listenerCount returns the number of registered handlers', () => {
    const bus = new Emitter<{ e: void }>();
    expect(bus.listenerCount('e')).toBe(0);
    bus.on('e', () => undefined);
    bus.on('e', () => undefined);
    expect(bus.listenerCount('e')).toBe(2);
  });

  it('emitting a once-handler during iteration removes it cleanly', () => {
    const bus = new Emitter<{ e: number }>();
    const calls: number[] = [];
    bus.once('e', (n) => calls.push(n));
    bus.on('e', (n) => calls.push(n * 10));
    bus.emit('e', 1);
    expect(calls).toEqual([1, 10]);
    bus.emit('e', 2);
    expect(calls).toEqual([1, 10, 20]);
  });

  it('handler exceptions are swallowed and logged', () => {
    const bus = new Emitter<{ boom: void }>();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    bus.on('boom', () => { throw new Error('handler oops'); });
    bus.on('boom', () => undefined);
    // Should not throw; should log; second handler should still fire.
    expect(() => bus.emit('boom', undefined)).not.toThrow();
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });

  it('on() returns an unsubscribe function', () => {
    const bus = new Emitter<{ e: void }>();
    const fn = vi.fn();
    const off = bus.on('e', fn);
    bus.emit('e', undefined);
    off();
    bus.emit('e', undefined);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
