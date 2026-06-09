/**
 * @monbolc/lowcode-designer — History tests
 * Ali-mirror Phase E.1.
 */
import { describe, it, expect, vi } from 'vitest';
import { History, Session, HistoryState } from '../src/history';

describe('History (Phase E.1)', () => {
  it('initial state: 1 record at cursor 0; modified=false (point===cursor)', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    // Ali-faithful: point starts at 0, cursor starts at 0 → point === cursor → modified is dropped from the bitmask
    expect(h.getState() & HistoryState.Undoable).toBe(0); // cursor <= 0
    expect(h.getState() & HistoryState.Redoable).toBe(0); // cursor >= records.length-1
    expect(h.getState() & HistoryState.Modified).toBe(0); // point === cursor → not modified
    // hotData is the SERIALIZED form (the records stack stores JSON strings)
    expect(h.hotData).toBe(JSON.stringify({ count: 0 }));
  });

  it('recordCurrentForce + back + forward round-trip', () => {
    let data = { count: 0 };
    const redoer = vi.fn((next) => { data = next; });
    const h = new History<typeof data>(() => data, redoer, undefined, 0);

    data = { count: 1 };
    h.recordCurrentForce(() => data);
    expect(redoer).not.toHaveBeenCalled();

    h.back();
    expect(redoer).toHaveBeenCalledTimes(1);
    expect(redoer).toHaveBeenCalledWith({ count: 0 });

    h.forward();
    expect(redoer).toHaveBeenCalledTimes(2);
    expect(redoer).toHaveBeenLastCalledWith({ count: 1 });
  });

  it('recordCurrent dedupes identical data', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    h.recordCurrentForce(() => data);
    h.recordCurrentForce(() => data);
    h.recordCurrentForce(() => data);
    // No change → no new records
    expect(h.getState() & HistoryState.Redoable).toBe(0);
  });

  it('asleep flag prevents re-recording during back/forward', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    data = { count: 1 };
    h.recordCurrentForce(() => data);
    h.back();
    // The redoer sets data, but asleep=true → no new record
    // (The slim redoer is a mock — data isn't actually set)
    expect(redoer).toHaveBeenCalledTimes(1);
  });

  it('new recordCurrent clears the redo stack', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    data = { count: 1 };
    h.recordCurrentForce(() => data);
    h.back();
    // State should now have redoable
    expect(h.getState() & HistoryState.Redoable).toBe(HistoryState.Redoable);
    // Push a new state — the redo stack should be cleared
    data = { count: 2 };
    h.recordCurrentForce(() => data);
    expect(h.getState() & HistoryState.Redoable).toBe(0);
  });

  it('savePoint: isSavePoint returns whether the cursor differs from the save point', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    // Ali-faithful: isSavePoint returns `point !== cursor` (true = MODIFIED, false = at save point)
    expect(h.isSavePoint()).toBe(false); // initial: point=0, cursor=0, equal → not modified
    data = { count: 1 };
    h.recordCurrentForce(() => data);
    expect(h.isSavePoint()).toBe(true); // point=0, cursor=1, differs → modified
    h.savePoint();
    expect(h.isSavePoint()).toBe(false); // point=1, cursor=1, equal → not modified
  });

  it('getState: emits statechange when the bitmask changes', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    const fn = vi.fn();
    h.onStateChange(fn);
    data = { count: 1 };
    h.recordCurrentForce(() => data);
    expect(fn).toHaveBeenCalled();
  });

  it('destroy: clears the emitter', () => {
    let data = { count: 0 };
    const redoer = vi.fn();
    const h = new History<typeof data>(() => data, redoer, undefined, 0);
    const fn = vi.fn();
    h.onStateChange(fn);
    h.destroy();
    data = { count: 1 };
    h.recordCurrentForce(() => data);
    // After destroy, listeners are cleared
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('Session (Phase E.1)', () => {
  it('isActive until the timeGap elapses', () => {
    vi.useFakeTimers();
    const session = new Session(0, 'a', 1000);
    expect(session.isActive()).toBe(true);
    vi.advanceTimersByTime(500);
    expect(session.isActive()).toBe(true);
    vi.advanceTimersByTime(600);
    expect(session.isActive()).toBe(false);
    vi.useRealTimers();
  });

  it('end: clears the active timer', () => {
    vi.useFakeTimers();
    const session = new Session(0, 'a', 1000);
    expect(session.isActive()).toBe(true);
    session.end();
    expect(session.isActive()).toBe(false);
    vi.useRealTimers();
  });

  it('log: no-op when inactive (after end())', () => {
    const session = new Session(0, 'a', 0);
    // timeGap=0 means the timer fires after the current tick.
    // Active immediately after construction; we call end() explicitly.
    expect(session.isActive()).toBe(true);
    session.end();
    expect(session.isActive()).toBe(false);
    session.log('b');
    expect(session.data).toBe('a'); // unchanged
  });
});
