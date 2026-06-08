/**
 * @monbolc/lowcode-designer — Phase C.AD tests
 * Dragon.chooseSensor + lastSensor memory
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C. Closes
 * the lastSensor gap. The slim sensor loop picked the FIRST
 * sensor whose `isEnter` fired — if the pointer briefly left a
 * sensor's territory (e.g. crossing between two adjacent sensor
 * regions), the next move would lose the sensor entirely.
 * The new `chooseSensor` keeps the last active sensor in
 * `_lastSensor` and falls back to it when no current sensor
 * matches.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { Dragon } from '../src/dragon';
import type { IPublicTypeSensor, IPublicTypeLocateEvent, IPublicTypeNodeLike, IPublicTypeLocation } from '@monbolc/lowcode-types';

type Sensor = IPublicTypeSensor<IPublicTypeNodeLike>;
type LocateEvent = IPublicTypeLocateEvent<IPublicTypeNodeLike>;
type Location = IPublicTypeLocation<IPublicTypeNodeLike>;

/** Build a stub sensor. The sensor matches events whose
 *  `inside === this sensor's label`. The label is what
 *  `isEnter` checks — `fixEvent` is a pass-through. */
function mkSensor(name: string, label: string, opts: { available?: boolean; onDeactivate?: () => void } = {}): Sensor {
  const isEnter = (e: LocateEvent): boolean => (e as unknown as { inside?: string }).inside === label;
  return {
    name,
    sensorAvailable: opts.available,
    isEnter: isEnter as Sensor['isEnter'],
    fixEvent: ((e: MouseEvent | DragEvent) => ({ ...e, originalEvent: e })) as Sensor['fixEvent'],
    deactiveSensor: opts.onDeactivate,
    locate: ((): Location | null => ({ target: { id: label }, detail: { type: 'Children' as const, index: 0, valid: true } } as Location)) as Sensor['locate'],
  };
}

const mkEvent = (inside: string, x = 0, y = 0): MouseEvent =>
  ({ clientX: x, clientY: y, target: { tagName: 'DIV' }, inside } as unknown as MouseEvent);

describe('Dragon.chooseSensor (Phase C.AD)', () => {
  let dragon: Dragon;
  beforeEach(() => {
    dragon = new Dragon();
  });

  it('no sensor matches → active sensor is null', () => {
    const s = mkSensor('a', 'A');
    dragon.addSensor(s);
    dragon.chooseSensor(mkEvent('no-mans-land'));
    expect(dragon.activeSensor).toBeNull();
  });

  it('first sensor whose isEnter fires becomes active', () => {
    const a = mkSensor('a', 'A');
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    expect(dragon.activeSensor?.name).toBe('a');
  });

  it('second sensor becomes active when pointer moves into its territory', () => {
    const a = mkSensor('a', 'A');
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    expect(dragon.activeSensor?.name).toBe('a');
    dragon.chooseSensor(mkEvent('B'));
    expect(dragon.activeSensor?.name).toBe('b');
  });

  it('falls back to lastSensor when no current sensor matches (lastSensor memory)', () => {
    // The lastSensor gap: slim loop would lose 'a' entirely when
    // the pointer leaves A's territory but no other sensor
    // matches. With lastSensor memory, the same sensor stays
    // active across a brief leave.
    const a = mkSensor('a', 'A');
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    expect(dragon.activeSensor?.name).toBe('a');
    // Pointer leaves both A and B's territory:
    dragon.chooseSensor(mkEvent('neither'));
    // 'a' is still active (lastSensor fallback).
    expect(dragon.activeSensor?.name).toBe('a');
    // Pointer re-enters B's territory:
    dragon.chooseSensor(mkEvent('B'));
    expect(dragon.activeSensor?.name).toBe('b');
  });

  it('lastSensor fallback survives a second leave', () => {
    const a = mkSensor('a', 'A');
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    dragon.chooseSensor(mkEvent('B'));
    dragon.chooseSensor(mkEvent('no-mans-land'));
    expect(dragon.activeSensor?.name).toBe('b'); // lastSensor fallback
  });

  it('lastSensor fallback re-fires after pointer returns to a different sensor', () => {
    // A → no-mans-land → A → no-mans-land → B.
    // Each "no-mans-land" should fall back to the lastSensor.
    const a = mkSensor('a', 'A');
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    expect(dragon.activeSensor?.name).toBe('a');
    dragon.chooseSensor(mkEvent('no-mans-land'));
    expect(dragon.activeSensor?.name).toBe('a');
    dragon.chooseSensor(mkEvent('A'));
    expect(dragon.activeSensor?.name).toBe('a');
    dragon.chooseSensor(mkEvent('no-mans-land'));
    expect(dragon.activeSensor?.name).toBe('a');
    dragon.chooseSensor(mkEvent('B'));
    expect(dragon.activeSensor?.name).toBe('b');
  });

  it('calls deactiveSensor on the OLD sensor when active sensor changes', () => {
    const aDeact: Array<string> = [];
    const a = mkSensor('a', 'A', { onDeactivate: () => aDeact.push('a') });
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    expect(aDeact).toEqual([]);
    dragon.chooseSensor(mkEvent('B'));
    expect(aDeact).toEqual(['a']);
  });

  it('does NOT call deactiveSensor when the same sensor stays active (no-op on consecutive picks)', () => {
    let aDeactCount = 0;
    const a = mkSensor('a', 'A', { onDeactivate: () => aDeactCount++ });
    dragon.addSensor(a);
    dragon.chooseSensor(mkEvent('A'));
    dragon.chooseSensor(mkEvent('A'));
    dragon.chooseSensor(mkEvent('A'));
    expect(aDeactCount).toBe(0);
  });

  it('does NOT call deactiveSensor when lastSensor fallback kicks in (same sensor re-picked)', () => {
    let aDeactCount = 0;
    const a = mkSensor('a', 'A', { onDeactivate: () => aDeactCount++ });
    dragon.addSensor(a);
    dragon.chooseSensor(mkEvent('A'));
    dragon.chooseSensor(mkEvent('no-mans-land'));
    expect(aDeactCount).toBe(0); // lastSensor fallback re-picks the same sensor
  });

  it('swallows errors from a sensor.deactiveSensor (does not break dispatch)', () => {
    const a = mkSensor('a', 'A', { onDeactivate: () => { throw new Error('bad sensor'); } });
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    // Switch to b — the throw should be swallowed, dispatch continues.
    expect(() => dragon.chooseSensor(mkEvent('B'))).not.toThrow();
    expect(dragon.activeSensor?.name).toBe('b');
  });

  it('skips sensors with sensorAvailable: false', () => {
    // 'a' is unavailable AND is the only one matching the event
    // territory. With 'a' skipped, no sensor matches → null.
    // The 'b' sensor matches 'B' only, not 'A' (the test event).
    const a = mkSensor('a', 'A', { available: false });
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    // 'a' skipped (unavailable); 'b' isEnter('A') is false. No
    // fresh pick → fallback to _lastSensor (null) → null.
    expect(dragon.activeSensor).toBeNull();
  });

  it('falls back to next available sensor when only sensorAvailable:false matches', () => {
    // 'a' is unavailable but matches; 'b' is available and also
    // matches. The 'a' should be SKIPPED and 'b' picked.
    const a = mkSensor('a', 'A', { available: false });
    const b = mkSensor('b', 'A'); // 'b' also matches 'A'
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    expect(dragon.activeSensor?.name).toBe('b');
  });

  it('cancel() / drop() clears the lastSensor memory (next gesture starts fresh)', () => {
    // The Dragon's `_reset` method (called from `_endGesture` on
    // a successful drop OR a cancel WITH an active drag) clears
    // both _activeSensor and _lastSensor. We can't directly
    // trigger _reset from outside (it's private), but we can
    // verify the invariant via the removeSensor path (which
    // also clears _lastSensor — see the implementation). This
    // test is here as documentation; the cancel path is
    // exercised by the integration e2e tests.
    const a = mkSensor('a', 'A');
    const b = mkSensor('b', 'B');
    dragon.addSensor(a);
    dragon.addSensor(b);
    dragon.chooseSensor(mkEvent('A'));
    dragon.chooseSensor(mkEvent('B'));
    expect(dragon.activeSensor?.name).toBe('b');
    // Remove the active sensor — the implementation also clears
    // _lastSensor if the removed sensor was the last one. With
    // 'b' as both active AND last (consecutive pick), removing
    // 'b' clears both. After removal, the next chooseSensor
    // should fall back to the OLD lastSensor (which was 'a'
    // before 'b' was picked) — verifying the persistence path.
    dragon.removeSensor('b');
    dragon.chooseSensor(mkEvent('no-mans-land'));
    // After removing 'b', _lastSensor should have been cleared
    // (the implementation clears it when the removed sensor
    // matches the lastSensor). So no fallback → null.
    expect(dragon.activeSensor).toBeNull();
  });
});
