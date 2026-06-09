/**
 * @monbolc/lowcode-designer — ResourceConsumer tests
 * Ali-mirror Phase D.I3.
 *
 * Validates the slim port of the `ResourceConsumer` autorun bridge. The
 * class wires a master-side `provider()` to a renderer-side `consumer`
 * via two `autorun`s from Phase A's `Observable-lite`.
 */
import { describe, it, expect, vi } from 'vitest';
import { ResourceConsumer } from '../../src/builtin-simulator/resource-consumer';
import { Observable } from '@monbolc/lowcode-utils';

describe('ResourceConsumer (Phase D.I3)', () => {
  it('provider is called immediately on construction; data is exposed via consume', async () => {
    const provider = vi.fn(() => 'initial');
    const consumer = vi.fn();
    const rc = new ResourceConsumer<string>(provider, (r, d) => d);
    rc.consume(consumer);
    // The autorun re-runs synchronously on first read; the consumer
    // also fires on the first autorun pass.
    expect(provider).toHaveBeenCalled();
    expect(consumer).toHaveBeenCalledWith('initial');
    rc.dispose();
  });

  it('when the provider returns a new value, the consumer is re-invoked', () => {
    const source = new Observable(1);
    const rc = new ResourceConsumer<number>(() => source.get(), (r, d) => d);
    const consumer = vi.fn();
    rc.consume(consumer);
    expect(consumer).toHaveBeenCalledWith(1);
    source.set(2);
    expect(consumer).toHaveBeenCalledWith(2);
    source.set(3);
    expect(consumer).toHaveBeenCalledWith(3);
    rc.dispose();
  });

  it('consume(renderer) routes through the ctor-supplied consumer(renderer, data)', () => {
    const sentinelRenderer = {
      isSimulatorRenderer: true as const,
      components: {},
      findDOMNodes: () => null,
      getClientRects: () => [],
    };
    const receivedRenderer = vi.fn();
    const rc = new ResourceConsumer<string>(
      () => 'x',
      (renderer, data) => {
        receivedRenderer(renderer);
        return data;
      },
    );
    rc.consume(sentinelRenderer);
    expect(receivedRenderer).toHaveBeenCalledWith(sentinelRenderer);
    rc.dispose();
  });

  // Phase D.I7b.13: ali-faithful throw when a renderer is passed
  // but no renderer consumer was registered. The slim port used
  // to silently no-op (the pre-existing TODO). D.I7b.13 makes
  // the misconfiguration explicit so the editor doesn't silently
  // drop a renderer.

  it('consume(renderer) without a ctor-supplied consumer throws ReferenceError (D.I7b.13)', () => {
    const sentinelRenderer = {
      isSimulatorRenderer: true as const,
      components: {},
      findDOMNodes: () => null,
      getClientRects: () => [],
    };
    const rc = new ResourceConsumer<string>(() => 'x');
    // No consumer ctor arg → `consume(renderer)` throws.
    expect(() => rc.consume(sentinelRenderer)).toThrow(ReferenceError);
    expect(() => rc.consume(sentinelRenderer)).toThrow(/consumer/);
    rc.dispose();
  });

  it('consume(plain-fn) without a ctor consumer does NOT throw (D.I7b.13)', () => {
    // Plain-function consumers are independent of the ctor's
    // `consumer` slot; the throw is gated on the renderer path
    // only.
    const rc = new ResourceConsumer<string>(() => 'x');
    expect(() => rc.consume(vi.fn())).not.toThrow();
    rc.dispose();
  });

  it('consumer error is caught + reported (D.I7b.13)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const consumerError = new Error('consumer-threw');
      const rc = new ResourceConsumer<number>(() => 42);
      rc.consume(() => {
        throw consumerError;
      });
      // Wait for the autorun to fire.
      await new Promise((r) => setTimeout(r, 0));
      expect(errorSpy).toHaveBeenCalled();
      // First call's first arg contains the error message.
      const callArgs = errorSpy.mock.calls[0];
      expect(String(callArgs?.[0])).toContain('ResourceConsumer');
      rc.dispose();
    } finally {
      errorSpy.mockRestore();
    }
  });

  it('consume(plain-fn) uses the plain function as the consumer', () => {
    const rc = new ResourceConsumer<number>(() => 10);
    const fn = vi.fn();
    rc.consume(fn);
    expect(fn).toHaveBeenCalledWith(10);
    rc.dispose();
  });

  it('consume is idempotent: only the first call wires the consuming autorun', () => {
    const fn1 = vi.fn();
    const fn2 = vi.fn();
    const rc = new ResourceConsumer<number>(() => 1);
    rc.consume(fn1);
    rc.consume(fn2); // should be ignored
    // Only fn1 was called; fn2 was never registered
    expect(fn1).toHaveBeenCalledTimes(1);
    expect(fn2).not.toHaveBeenCalled();
    rc.dispose();
  });

  it('waitFirstConsume resolves on the first consumer call', async () => {
    const rc = new ResourceConsumer<number>(() => 42);
    const promise = rc.waitFirstConsume();
    rc.consume(() => undefined);
    await expect(promise).resolves.toBeUndefined();
    rc.dispose();
  });

  it('waitFirstConsume resolves immediately if first consume already happened', async () => {
    const rc = new ResourceConsumer<number>(() => 7);
    rc.consume(() => undefined);
    // Give the microtask queue a chance to settle
    await new Promise((resolve) => setTimeout(resolve, 0));
    await expect(rc.waitFirstConsume()).resolves.toBeUndefined();
    rc.dispose();
  });

  it('dispose stops both autoruns; subsequent provider changes do not invoke the consumer', () => {
    const source = new Observable(1);
    const fn = vi.fn();
    const rc = new ResourceConsumer<number>(() => source.get());
    rc.consume(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    rc.dispose();
    source.set(2);
    source.set(3);
    // The consumer should NOT have been called after dispose
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
