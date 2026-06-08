/**
 * @monbolc/lowcode-utils — throttle (ali-faithful port)
 *
 * Port of alibaba/lowcode-engine's
 * `designer/src/builtin-simulator/utils/throttle.ts`. Ali-faithful
 * leading + trailing throttle with RAF-aware scheduling. The
 * result is callable like the input function and carries the
 * same return value semantics.
 *
 * Why a port: sapu's `simulator-host.ts` (Phase C) needs
 * ali-faithful throttle for the viewport auto-scroll + offset
 * observer paths. We could `lodash-es.throttle` instead, but
 * a local 80-line util avoids a dep and matches the slim
 * stance. Same algorithm as ali, no behavioural change.
 *
 * Ali's algorithm (preserved verbatim, with a small TS tightening
 * — we type the function as `(...args: unknown[]) => unknown`
 * instead of `Function` per the `@typescript-eslint/ban-types`
 * rule ali bypasses):
 *   - Leading edge: invoke immediately, schedule a trailing
 *     invocation `delay` ms later.
 *   - Trailing edge: if more calls came in during the wait,
 *     invoke once more with the LAST call's args.
 *   - `requestAnimationFrame` when available (for scroll/animation
 *     paths); falls back to `setTimeout` in non-DOM environments
 *     (e.g. happy-dom tests).
 *
 * The exported function returns a disposer (ali's debounced
 * does not — sapu adds this for cleanup symmetry with the
 * rest of the engine).
 */

// Ali's original uses the global `requestAnimationFrame` directly.
// TS's default `lib` (no DOM) doesn't include it; we declare
// the two we use as `any` to keep this file DOM-free.
declare const requestAnimationFrame: (cb: (time: number) => void) => number;
declare const cancelAnimationFrame: (id: number) => void;

const useRAF = typeof requestAnimationFrame === 'function';

/**
 * Wrap a function in ali-faithful throttle behavior.
 *
 * @param func  The function to throttle.
 * @param delay Minimum delay between invocations, in ms.
 * @returns A throttled function that behaves like `func`.
 *          Carries a `.dispose()` method to cancel any pending
 *          trailing invocation (sapu addition; ali's function
 *          has no equivalent — there is no way to interrupt
 *          a pending `requestAnimationFrame` cleanly).
 */
export function throttle<TArgs extends unknown[], TReturn>(
  func: (...args: TArgs) => TReturn,
  delay: number,
): ((...args: TArgs) => TReturn) & { dispose: () => void } {
  let lastArgs: TArgs | undefined;
  let lastThis: unknown;
  let result: TReturn | undefined;
  let timerId: number | undefined;
  let lastCalled: number | undefined;
  let lastInvoked = 0;
  let disposed = false;

  function invoke(time: number): TReturn | undefined {
    const args = lastArgs!;
    const thisArg = lastThis;
    lastArgs = undefined;
    lastThis = undefined;
    lastInvoked = time;
    result = func.apply(thisArg as never, args) as TReturn;
    return result;
  }

  function startTimer(pendingFunc: () => void, wait: number): number {
    if (useRAF) {
      return requestAnimationFrame(pendingFunc);
    }
    return setTimeout(pendingFunc, wait) as unknown as number;
  }

  function clearTimer(id: number | undefined): void {
    if (id === undefined) return;
    if (useRAF) {
      cancelAnimationFrame(id);
    } else {
      clearTimeout(id);
    }
  }

  function leadingEdge(time: number): TReturn | undefined {
    lastInvoked = time;
    timerId = startTimer(timerExpired, delay);
    return invoke(time);
  }

  function shouldInvoke(time: number): boolean {
    const timeSinceLastCalled = time - lastCalled!;
    const timeSinceLastInvoked = time - lastInvoked;
    return (
      lastCalled === undefined ||
      timeSinceLastCalled >= delay ||
      timeSinceLastCalled < 0 ||
      timeSinceLastInvoked >= delay
    );
  }

  function remainingWait(time: number): number {
    const timeSinceLastCalled = time - lastCalled!;
    const timeSinceLastInvoked = time - lastInvoked;
    return Math.min(delay - timeSinceLastCalled, delay - timeSinceLastInvoked);
  }

  function timerExpired(): void {
    const time = Date.now();
    if (shouldInvoke(time)) {
      trailingEdge(time);
      return;
    }
    timerId = startTimer(timerExpired, remainingWait(time));
  }

  function trailingEdge(time: number): TReturn | undefined {
    timerId = undefined;
    if (lastArgs) {
      return invoke(time);
    }
    lastArgs = undefined;
    lastThis = undefined;
    return result;
  }

  function debounced(this: unknown, ...args: TArgs): TReturn | undefined {
    if (disposed) return result;
    const time = Date.now();
    const isInvoking = shouldInvoke(time);
    lastArgs = args;
    lastThis = this;
    lastCalled = time;
    if (isInvoking) {
      if (timerId === undefined) {
        return leadingEdge(lastCalled);
      }
      timerId = startTimer(timerExpired, delay);
      return invoke(lastCalled);
    }
    if (timerId === undefined) {
      timerId = startTimer(timerExpired, delay);
    }
    return result;
  }

  const wrapped = debounced as ((...args: TArgs) => TReturn) & { dispose: () => void };
  wrapped.dispose = (): void => {
    disposed = true;
    clearTimer(timerId);
    timerId = undefined;
  };
  return wrapped;
}
