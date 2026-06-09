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

  it('consume(renderer) without a ctor-supplied consumer is a silent no-op (ali TODO)', () => {
    const sentinelRenderer = {
      isSimulatorRenderer: true as const,
      components: {},
      findDOMNodes: () => null,
      getClientRects: () => [],
    };
    const rc = new ResourceConsumer<string>(() => 'x');
    // No consumer ctor arg → `consume(renderer)` silently no-ops.
    expect(() => rc.consume(sentinelRenderer)).not.toThrow();
    rc.dispose();
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
