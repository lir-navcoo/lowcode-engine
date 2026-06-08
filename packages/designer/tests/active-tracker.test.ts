/**
 * @monbolc/lowcode-designer — ActiveTracker tests (P23)
 *
 * Ali-faithful lock of the focusNode concept: one active
 * node per Project, distinct from multi-select `selectedIds`.
 * Plugins use this as "the next command's target" without
 * colliding with the canvas's selection state.
 */
import { describe, it, expect } from 'vitest';
import { ActiveTracker } from '../src/active-tracker';

describe('ActiveTracker (P23)', () => {
  it('starts with no active node', () => {
    const t = new ActiveTracker();
    expect(t.activeNodeId).toBeNull();
  });

  it('set() updates the active id and emits the change event', () => {
    const t = new ActiveTracker();
    const seen: Array<{ id: string | null }> = [];
    t.onActiveNodeChange((id) => seen.push({ id }));
    t.set('n1');
    expect(t.activeNodeId).toBe('n1');
    expect(seen).toEqual([{ id: 'n1' }]);
  });

  it('set(null) clears the active node and emits id: null', () => {
    const t = new ActiveTracker();
    t.set('n1');
    const seen: string[] = [];
    t.onActiveNodeChange((id) => seen.push(id ?? 'null'));
    t.set(null);
    expect(t.activeNodeId).toBeNull();
    expect(seen).toEqual(['null']);
  });

  it('set() is a no-op when the id is unchanged (no event fired)', () => {
    const t = new ActiveTracker();
    t.set('n1');
    let calls = 0;
    t.onActiveNodeChange(() => { calls += 1; });
    t.set('n1');
    expect(calls).toBe(0);
  });

  it('set() rejects unknown ids when an isValid predicate is supplied', () => {
    const t = new ActiveTracker();
    t.set('n1'); // baseline
    let calls = 0;
    t.onActiveNodeChange(() => { calls += 1; });
    t.set('ghost', (id) => id === 'real');
    expect(t.activeNodeId).toBe('n1'); // unchanged
    expect(calls).toBe(0);
    t.set('real', (id) => id === 'real');
    expect(t.activeNodeId).toBe('real');
    expect(calls).toBe(1);
  });

  it('onActiveNodeChange returns a disposer that removes the listener', () => {
    const t = new ActiveTracker();
    const seen: Array<string | null> = [];
    const dispose = t.onActiveNodeChange((id) => seen.push(id));
    t.set('a');
    dispose();
    t.set('b');
    expect(seen).toEqual(['a']);
  });

  it('multiple subscribers each get the change event', () => {
    const t = new ActiveTracker();
    const a: string[] = [];
    const b: string[] = [];
    t.onActiveNodeChange((id) => a.push(id ?? 'null'));
    t.onActiveNodeChange((id) => b.push(id ?? 'null'));
    t.set('x');
    expect(a).toEqual(['x']);
    expect(b).toEqual(['x']);
  });
});
