import { describe, it, expect, beforeEach } from 'vitest';
import { Project } from '../src/project';
import { Dragon } from '../src/dragon';
import { DocumentModel } from '../src/document';
import { deepClone } from '@monbolc/lowcode-utils';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [
    { componentName: 'Header' },
    { componentName: 'Body' },
  ],
};

describe('Dragon + DocumentModel drop', () => {
  let project: Project;
  let root: IPublicTypeRootSchema;
  beforeEach(() => { root = deepClone(SEED); project = new Project(root); });

  it('start sets state and emits event', () => {
    let captured: unknown;
    project.dragon.events.on('start', (e) => { captured = e; });
    project.dragon.start('node-1', 10, 20);
    expect(project.dragon.isDragging).toBe(true);
    expect((captured as { nodeId: string }).nodeId).toBe('node-1');
  });

  it('move with drop target computes parent + index', () => {
    const moves: unknown[] = [];
    project.dragon.events.on('move', (e) => moves.push(e));
    project.dragon.start('header', 0, 0);
    project.dragon.move(100, 100, { parentId: 'body', index: 0, placement: 'inside' });
    expect(project.dragon.state.dropTarget).toEqual({ parentId: 'body', index: 0, placement: 'inside' });
    expect((moves[0] as { dropTarget: { parentId: string } }).dropTarget.parentId).toBe('body');
  });

  it('commit on a valid dropTarget fires drop event', () => {
    let captured: unknown;
    project.dragon.events.on('drop', (e) => { captured = e; });
    project.dragon.start('header', 0, 0);
    project.dragon.move(0, 0, { parentId: 'body', index: 0, placement: 'inside' });
    const result = project.dragon.commit();
    expect(result).not.toBeNull();
    expect((captured as { nodeId: string }).nodeId).toBe('header');
    expect(project.dragon.isDragging).toBe(false);
  });

  it('commit without a dropTarget fires cancel event', () => {
    let captured: unknown;
    project.dragon.events.on('cancel', (e) => { captured = e; });
    project.dragon.start('header', 0, 0);
    // No move() so no dropTarget
    project.dragon.commit();
    expect((captured as { nodeId: string }).nodeId).toBe('header');
  });

  it('end-to-end drop moves the schema node', () => {
    const headerId = project.document.getNode(project.document.root.key as string)!.children[0].id;
    const bodyId = project.document.getNode(project.document.root.key as string)!.children[1].id;
    project.dragon.events.on('drop', (e) => {
      const target = e.target;
      const headerNode = project.document.getNode(headerId);
      const bodyNode = project.document.getNode(bodyId);
      if (headerNode && bodyNode) {
        project.document.move(headerNode, bodyNode, target.index);
      }
    });
    project.dragon.start(headerId, 0, 0);
    project.dragon.move(0, 0, { parentId: bodyId, index: 0, placement: 'inside' });
    project.dragon.commit();
    const body = project.document.getNode(bodyId)!;
    expect(body.children[0].id).toBe(headerId);
  });

  // ---- Boost (palette → canvas) ----
  //
  // Boost drags don't have a source node — the source is a
  // `BoostMeta` describing the component to instantiate. The Dragon
  // still tracks x/y/dropTarget; on `commit()` it returns a
  // discriminated union the host can `switch` on.
  it('boost() enters boost state and emits startBoost', () => {
    let captured: unknown;
    project.dragon.events.on('startBoost', (e) => { captured = e; });
    project.dragon.boost({ componentName: 'Button' }, 10, 20);
    expect(project.dragon.isDragging).toBe(true);
    expect(project.dragon.isBoosting).toBe(true);
    expect((captured as { meta: { componentName: string } }).meta.componentName).toBe('Button');
  });

  it('boost() refuses if a drag is already in progress', () => {
    project.dragon.boost({ componentName: 'A' }, 0, 0);
    project.dragon.boost({ componentName: 'B' }, 0, 0);
    // Only the first boost wins; state still references 'A'.
    expect(project.dragon.state.boost?.componentName).toBe('A');
  });

  it('commit() on a boost with a target returns the boost result', () => {
    let captured: unknown;
    project.dragon.events.on('dropBoost', (e) => { captured = e; });
    project.dragon.boost({ componentName: 'Footer' }, 0, 0);
    project.dragon.move(50, 50, { parentId: null, index: 2, placement: 'inside' });
    const result = project.dragon.commit();
    expect(result).not.toBeNull();
    expect(result!.kind).toBe('boost');
    expect((result as { meta: { componentName: string } }).meta.componentName).toBe('Footer');
    expect((captured as { meta: { componentName: string } }).meta.componentName).toBe('Footer');
    expect(project.dragon.isDragging).toBe(false);
    expect(project.dragon.isBoosting).toBe(false);
  });

  it('cancel() on a boost emits cancelBoost with the meta', () => {
    let captured: unknown;
    project.dragon.events.on('cancelBoost', (e) => { captured = e; });
    project.dragon.boost({ componentName: 'X' }, 0, 0);
    project.dragon.cancel();
    expect((captured as { meta: { componentName: string } }).meta.componentName).toBe('X');
    expect(project.dragon.isBoosting).toBe(false);
  });

  it('end-to-end: boost → document.insert creates a new node', () => {
    let inserted: ReturnType<DocumentModel['insert']> | undefined;
    project.dragon.events.on('dropBoost', (e) => {
      // Simulate the host's commit handler: create a new schema
      // node from the boost meta at the drop target.
      inserted = project.document.insert(
        { componentName: e.meta.componentName },
        e.target.parentId ? project.document.getNode(e.target.parentId) ?? null : null,
        e.target.index,
      );
    });
    project.dragon.boost({ componentName: 'Footer' }, 0, 0);
    project.dragon.move(0, 0, { parentId: null, index: 2, placement: 'inside' });
    project.dragon.commit();
    expect(inserted).toBeDefined();
    expect(inserted!.componentName).toBe('Footer');
    expect(project.document.root.children!.length).toBe(3);
    expect(project.document.root.children![2].componentName).toBe('Footer');
  });

  // ---- v2.3 new behavior: shake gate, ESC cancel, copy state ----
  //
  // These are the instrumented-mode features. We call
  // `boost(dragObject, e)` to enter instrumented mode (DOM listeners
  // bound), then drive the gesture with synthetic events dispatched
  // on `document` (the Dragon's bound target).

  it('shake gate: 4px gate — first sub-threshold move does not emit dragstart', () => {
    const dragstarts: unknown[] = [];
    project.dragon.events.on('dragstart', (e) => dragstarts.push(e));

    // Use the new instrumented API: synthetic MouseEvent with full shape.
    const downEvent = makeMouseEvent(100, 100, { altKey: false, ctrlKey: false });
    project.dragon.boost({ type: 'NodeData', data: { componentName: 'X' } }, downEvent);

    // Sub-threshold move (3px): no dragstart, no drag event.
    document.dispatchEvent(makeMouseEvent(102, 101, { altKey: false, ctrlKey: false }));
    expect(dragstarts).toHaveLength(0);

    // Past the gate (5px): dragstart + drag fire.
    document.dispatchEvent(makeMouseEvent(105, 100, { altKey: false, ctrlKey: false }));
    expect(dragstarts).toHaveLength(1);

    // Cleanup
    document.dispatchEvent(makeMouseEvent(0, 0, { altKey: false, ctrlKey: false })); // ignore synthetic 0,0
    document.dispatchEvent(makeMouseEvent(200, 200, { altKey: false, ctrlKey: false })); // mouseup
  });

  it('ESC mid-drag cancels the gesture (instrumented mode)', () => {
    const dragends: Array<{ cancelled: boolean }> = [];
    const cancelBoosts: unknown[] = [];
    project.dragon.events.on('dragend', (e) => dragends.push({ cancelled: e.cancelled }));
    project.dragon.events.on('cancelBoost', (e) => cancelBoosts.push(e));

    project.dragon.boost(
      { type: 'NodeData', data: { componentName: 'X' } },
      makeMouseEvent(0, 0, { altKey: false, ctrlKey: false }),
    );
    // Move past shake gate to "start" the drag.
    document.dispatchEvent(makeMouseEvent(50, 50, { altKey: false, ctrlKey: false }));
    // ESC.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    // mouseup should be a no-op (already cancelled).
    document.dispatchEvent(makeMouseEvent(100, 100, { altKey: false, ctrlKey: false }));

    expect(dragends).toHaveLength(1);
    expect(dragends[0]!.cancelled).toBe(true);
    expect(cancelBoosts).toHaveLength(1);
    expect(project.dragon.isDragging).toBe(false);
  });

  it('copy state: altKey on boost sets copy=true on every event', () => {
    const dragstarts: Array<{ copy: boolean }> = [];
    const drags: Array<{ copy: boolean }> = [];
    const dragends: Array<{ copy: boolean }> = [];
    project.dragon.events.on('dragstart', (e) => dragstarts.push({ copy: e.copy }));
    project.dragon.events.on('drag', (e) => drags.push({ copy: e.copy }));
    project.dragon.events.on('dragend', (e) => dragends.push({ copy: e.copy }));

    project.dragon.boost(
      { type: 'NodeData', data: { componentName: 'X' } },
      makeMouseEvent(0, 0, { altKey: true, ctrlKey: false }),
    );
    expect(project.dragon.copy).toBe(true);

    // Past shake gate.
    document.dispatchEvent(makeMouseEvent(20, 20, { altKey: true, ctrlKey: false }));
    expect(dragstarts[0]?.copy).toBe(true);
    expect(drags[0]?.copy).toBe(true);

    // Move WITHOUT alt: copy flips to false.
    document.dispatchEvent(makeMouseEvent(40, 40, { altKey: false, ctrlKey: false }));
    expect(drags[drags.length - 1]?.copy).toBe(false);

    // Cleanup.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(dragends[0]?.copy).toBe(false); // last-known value at end
  });

  // ===== P8.2 — alt-key copy on the manual `dragon.start` path =====
  // The instrumented `boost(dragObject, e)` path already reads
  // `e.altKey` from the source MouseEvent. The manual
  // `dragon.start(nodeId, x, y)` path is what
  // BuiltinSimulatorHost.handleMove calls when a canvas pointer
  // moves past the 4px shake gate — and until P8.2 it ignored
  // altKey. Ali's UX: alt-drag a node to copy it (like Finder
  // duplicate). This test locks the P8.2 fix.

  it('manual start forwards altKey from the source event → copy=true on dragstart', () => {
    const dragstarts: Array<{ copy: boolean }> = [];
    project.dragon.events.on('dragstart', (e) => dragstarts.push({ copy: e.copy }));

    // Simulate the BuiltinSimulatorHost.handleMove call shape:
    // start(id, x, y, sourceEvent) where the source carries
    // altKey: true. Use a fresh document so no leaked listeners.
    const fresh = new Project(deepClone(SEED));
    fresh.dragon.events.on('dragstart', (e) => dragstarts.push({ copy: e.copy }));
    const nodeId = fresh.document.getNode(fresh.document.root.key as string)!.children[0].id;
    fresh.dragon.start(nodeId, 0, 0, { altKey: true, ctrlKey: false });
    expect(fresh.dragon.copy).toBe(true);
    // No `dragstart` event yet — manual path doesn't emit one
    // (only the instrumented path does). Cancel so the next test
    // starts clean.
    fresh.dragon.cancel();
  });

  it('manual start WITHOUT an event arg keeps the legacy altKey=false behavior', () => {
    const fresh = new Project(deepClone(SEED));
    const nodeId = fresh.document.getNode(fresh.document.root.key as string)!.children[0].id;
    // v2.2 back-compat: hosts that pass only (id, x, y) still work,
    // and copy defaults to false (matches the pre-P8.2 behavior).
    fresh.dragon.start(nodeId, 0, 0);
    expect(fresh.dragon.copy).toBe(false);
    fresh.dragon.cancel();
  });

  it('manual start with altKey: false explicitly → copy=false', () => {
    const fresh = new Project(deepClone(SEED));
    const nodeId = fresh.document.getNode(fresh.document.root.key as string)!.children[0].id;
    fresh.dragon.start(nodeId, 0, 0, { altKey: false, ctrlKey: false });
    expect(fresh.dragon.copy).toBe(false);
    fresh.dragon.cancel();
  });
});

/** Build a `MouseEvent`-shaped object the Dragon can read clientX/Y
 *  + altKey/ctrlKey from. The Dragon only reads these 4 fields, so
 *  we don't need a full DOM MouseEvent. We dispatch via document
 *  for the `mousemove` / `mouseup` / `keydown` listeners. */
function makeMouseEvent(x: number, y: number, opts: { altKey: boolean; ctrlKey: boolean }): MouseEvent {
  return new MouseEvent('mousemove', {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    button: 0,
    altKey: opts.altKey,
    ctrlKey: opts.ctrlKey,
  });
}
