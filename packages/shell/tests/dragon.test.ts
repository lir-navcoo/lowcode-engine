/**
 * @monbolc/lowcode-shell — PublicDragon tests
 *
 * Covers the v2.3 public Dragon facade:
 *   - `engine.dragon` is a PublicDragon (instance of the class)
 *   - state mirrors `project.dragon` (dragging, boosting, sensors)
 *   - `addSensor` / `removeSensor` round-trip
 *   - `onDragstart` / `onDrag` / `onDragend` return disposers that
 *     actually unsubscribe (the contract plugin authors rely on)
 *   - `cancel()` reaches the inner Dragon
 *   - throws before mount (parity with `getProject()`)
 *   - thrown out after `destroy()` (the engine tears it down)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SapuEngine } from '../src/sapu-engine';
import { PublicDragon } from '../src/dragon';
import type { IPublicTypeSensor } from '@monbolc/lowcode-types';

const sampleSchema = { componentName: 'Page' };

describe('SapuEngine.dragon (v2.3 PublicDragon wrapper)', () => {
  let engine: SapuEngine;
  beforeEach(() => {
    engine = new SapuEngine();
  });

  it('throws before mount() — parity with getProject()', () => {
    expect(() => engine.dragon).toThrowError(/mount/i);
  });

  it('is a PublicDragon instance after mount()', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    expect(engine.dragon).toBeInstanceOf(PublicDragon);
  });

  it('state mirrors project.dragon (dragging / boosting / sensors are live)', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const inner = engine.getProject().dragon;
    const outer = engine.dragon;
    // Both start idle.
    expect(outer.dragging).toBe(false);
    expect(outer.boosting).toBe(false);
    expect(outer.sensors.length).toBe(0);
    // Boost through the inner; outer sees it.
    inner.boost({ componentName: 'Footer' }, 0, 0);
    expect(outer.dragging).toBe(true);
    expect(outer.boosting).toBe(true);
    // Cancel through the outer; inner sees it.
    outer.cancel();
    expect(inner.isDragging).toBe(false);
  });

  it('addSensor / removeSensor go through to the inner registry', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const outer = engine.dragon;
    const sensor: IPublicTypeSensor = {
      name: 'test.sensor',
      isEnter: () => true,
      fixEvent: (e) => ({
        globalX: e.clientX,
        globalY: e.clientY,
        canvasX: e.clientX,
        canvasY: e.clientY,
        clientX: e.clientX,
        clientY: e.clientY,
        target: e.target as Element | null,
        dragObject: { type: 'Any', extra: null },
      }),
      locate: () => null,
    };
    outer.addSensor(sensor);
    expect(outer.sensors.length).toBe(1);
    expect(outer.sensors[0]?.name).toBe('test.sensor');
    // Same instance visible on the inner.
    expect(engine.getProject().dragon.sensors[0]).toBe(sensor);
    // Remove through the outer; inner updates.
    outer.removeSensor('test.sensor');
    expect(outer.sensors.length).toBe(0);
  });

  it('onDragstart returns a disposer that actually unsubscribes', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const inner = engine.getProject().dragon;
    const outer = engine.dragon;
    const listener = vi.fn();
    const off = outer.onDragstart(listener);
    // Emit a synthetic dragstart on the inner; outer should relay.
    inner.events.emit('dragstart', {
      dragObject: { type: 'Any', extra: null },
      copy: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    // Unsubscribed; further emits don't reach the listener.
    off();
    inner.events.emit('dragstart', {
      dragObject: { type: 'Any', extra: null },
      copy: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('onDrag passes a synthesised locateEvent with the current pointer', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const inner = engine.getProject().dragon;
    const outer = engine.dragon;
    const listener = vi.fn();
    outer.onDrag(listener);
    inner.events.emit('drag', {
      dragObject: { type: 'Any', extra: null },
      copy: false,
      x: 42,
      y: 84,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    const arg = listener.mock.calls[0]?.[0] as {
      copy: boolean;
      locateEvent: { globalX: number; globalY: number; clientX: number; clientY: number; dragObject: unknown };
    };
    expect(arg.copy).toBe(false);
    expect(arg.locateEvent.globalX).toBe(42);
    expect(arg.locateEvent.globalY).toBe(84);
    expect(arg.locateEvent.clientX).toBe(42);
    expect(arg.locateEvent.clientY).toBe(84);
    expect(arg.locateEvent.dragObject).toEqual({ type: 'Any', extra: null });
  });

  it('onDragend returns a disposer that actually unsubscribes', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const inner = engine.getProject().dragon;
    const outer = engine.dragon;
    const listener = vi.fn();
    const off = outer.onDragend(listener);
    inner.events.emit('dragend', {
      dragObject: { type: 'Any', extra: null },
      copy: false,
      cancelled: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    off();
    inner.events.emit('dragend', {
      dragObject: { type: 'Any', extra: null },
      copy: false,
      cancelled: false,
    });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('cancel() cancels an in-flight drag on the inner Dragon', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const inner = engine.getProject().dragon;
    inner.boost({ componentName: 'Footer' }, 0, 0);
    expect(inner.isDragging).toBe(true);
    engine.dragon.cancel();
    expect(inner.isDragging).toBe(false);
  });

  it('exposes dragon on the IPluginContext so plugins can use it', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    const seen: { dragon: unknown } = { dragon: null };
    engine.registerPlugin({
      name: 'probe',
      init: (ctx) => { seen.dragon = ctx.dragon; },
    });
    expect(seen.dragon).toBe(engine.dragon);
  });

  it('throws after destroy() (the engine tears it down on destroy)', () => {
    engine.mount({ schema: sampleSchema, components: {} });
    engine.destroy();
    expect(() => engine.dragon).toThrowError(/mount/i);
  });
});
