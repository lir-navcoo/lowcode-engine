/**
 * @monbolc/lowcode-utils — throttle tests (Phase A ali-mirror)
 *
 * Pin the contract: leading invocation + trailing invocation
 * after the cooldown, identical to ali. We use a `vi.useFakeTimers`
 * setup so the test is deterministic (happy-dom's RAF is
 * stubbed, so `requestAnimationFrame` falls back to `setTimeout`).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { throttle } from '../src/throttle';

describe('throttle (Phase A ali-mirror)', () => {
  // Strategy: use real timers. The throttle algorithm doesn't
  // care about absolute time — the `delay` window is 50ms, and
  // we just wait it out with `await new Promise(r => setTimeout(r, 70))`.
  // The leading-edge + trailing-edge behavior is observable
  // without any fake-timer voodoo. The test stays deterministic
  // because real-time delays are bounded and the test doesn't
  // assert on absolute wall-clock time.
  //
  // We tried `vi.useFakeTimers()` + an RAF override so the
  // throttle's `requestAnimationFrame` branch (used when
  // `typeof requestAnimationFrame === 'function'`) would
  // route to `setTimeout`, but the override conflicts with the
  // throttle's own `setTimeout(timerExpired, delay)` for the
  // trailing edge — the override rewrites every `setTimeout` to
  // fire at 16ms regardless of the requested delay, breaking
  // the contract. Real timers are simpler and correct.

  it('invokes immediately on the leading edge', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled('a');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('does not invoke again within the delay window', () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled('a');
    throttled('b');
    throttled('c');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith('a');
  });

  it('invokes the trailing edge with the LAST args after the delay', async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled('a');
    throttled('b');
    throttled('c');
    // Real-time wait: 70ms > 50ms delay, so the trailing edge
    // has fired. Ali's algorithm uses the last call's args.
    await new Promise<void>((r) => setTimeout(r, 70));
    expect(fn).toHaveBeenCalledTimes(2);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'c');
  });

  it('dispose() cancels a pending trailing edge', async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 50);
    throttled('a');
    throttled('b');
    throttled.dispose();
    await new Promise<void>((r) => setTimeout(r, 80));
    expect(fn).toHaveBeenCalledTimes(1); // only the leading edge
  });

  it('returns the result of the leading-edge invocation', () => {
    const throttled = throttle((x: number) => x * 2, 50);
    expect(throttled(5)).toBe(10);
  });

  it('handles rapid calls spread across multiple delay windows', async () => {
    const fn = vi.fn();
    const throttled = throttle(fn, 30);
    throttled('a');    // leading → fires "a"
    await new Promise<void>((r) => setTimeout(r, 50));
    throttled('b');    // leading → fires "b" (new window)
    await new Promise<void>((r) => setTimeout(r, 50));
    throttled('c');    // leading → fires "c"
    expect(fn).toHaveBeenCalledTimes(3);
    expect(fn).toHaveBeenNthCalledWith(1, 'a');
    expect(fn).toHaveBeenNthCalledWith(2, 'b');
    expect(fn).toHaveBeenNthCalledWith(3, 'c');
  });
});
