/**
 * @monbolc/lowcode-designer — Phase C.AE tests
 * HTML5 DnD branch on Dragon
 *
 * Per `~/.claude/plans/dynamic-marinating-rabbit.md` Phase C. Closes
 * the last Phase C item: ali's dragon has a `isBoostFromDragAPI`
 * branch that handles browser-native HTML5 drags (e.g. a
 * `<div draggable="true">` palette row dragging into the canvas).
 * Sapu's slim dragon was mouse-only. After this commit, a DragEvent
 * passed to `boost(dragObject, e)` triggers the HTML5 path:
 * sets `dataTransfer.effectAllowed` + `setData`, wires `drop` +
 * `dragend` listeners, fires the same start/dragstart events
 * the mouse path would.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Dragon } from '../src/dragon';

type AnyEventListener = (e: Event) => void;
const listeners = new Map<string, Set<AnyEventListener>>();

/** Stub document.addEventListener / removeEventListener to
 *  capture the handlers so tests can fire them manually. */
function installDocListenerSpy(): { fired: (type: string, e?: any) => void } {
  const origAdd = document.addEventListener.bind(document);
  const origRemove = document.removeEventListener.bind(document);
  const spy = vi.spyOn(document, 'addEventListener').mockImplementation((type: string, handler: any) => {
    if (!listeners.has(type)) listeners.set(type, new Set());
    listeners.get(type)!.add(handler);
    return origAdd(type, handler);
  });
  vi.spyOn(document, 'removeEventListener').mockImplementation((type: string, handler: any) => {
    listeners.get(type)?.delete(handler);
    return origRemove(type, handler);
  });
  return {
    fired(type: string, e: any = {}) {
      for (const h of listeners.get(type) ?? []) h(e);
    },
  };
}

function mkDragEvent(type: string, dataTransfer?: { setData: ReturnType<typeof vi.fn>; effectAllowed?: string }): DragEvent {
  const ev = { type, clientX: 100, clientY: 50, dataTransfer, altKey: false, ctrlKey: false, preventDefault: () => undefined } as unknown as DragEvent;
  return ev;
}

describe('Dragon HTML5 DnD branch (Phase C.AE)', () => {
  let dragon: Dragon;
  let fired: (type: string, e?: any) => void;

  beforeEach(() => {
    listeners.clear();
    fired = installDocListenerSpy().fired;
    dragon = new Dragon();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('boost from a DragEvent sets dataTransfer.effectAllowed + setData', () => {
    const setData = vi.fn();
    const dt = { effectAllowed: '', setData } as unknown as DataTransfer;
    const ev = mkDragEvent('dragstart', dt as any);
    dragon.boost({ type: 'NodeData', data: { componentName: 'Test', initialProps: {} } } as never, ev);
    expect((dt as any).effectAllowed).toBe('all');
    expect(setData).toHaveBeenCalledWith('application/json', '{}');
  });

  it('boost from a DragEvent fires startBoost + dragstart events', () => {
    const seen: string[] = [];
    dragon.events.on('startBoost', () => seen.push('startBoost'));
    dragon.events.on('dragstart', () => seen.push('dragstart'));
    dragon.boost({ type: 'NodeData', data: { componentName: 'Test', initialProps: {} } } as never, mkDragEvent('dragstart', { setData: vi.fn() } as any));
    expect(seen).toContain('startBoost');
    expect(seen).toContain('dragstart');
  });

  it('HTML5 boost registers drop + dragend listeners (capture: true)', () => {
    dragon.boost({ type: 'NodeData', data: { componentName: 'Test', initialProps: {} } } as never, mkDragEvent('dragstart', { setData: vi.fn() } as any));
    expect(listeners.get('drop')?.size ?? 0).toBeGreaterThan(0);
    expect(listeners.get('dragend')?.size ?? 0).toBeGreaterThan(0);
  });

  it('drop event on document fires dropBoost (commits the gesture)', () => {
    const seen: Array<{ meta: unknown; target: unknown }> = [];
    dragon.events.on('dropBoost', (e) => seen.push({ meta: (e as { meta: unknown }).meta, target: (e as { target: unknown }).target }));
    dragon.boost({ type: 'NodeData', data: { componentName: 'Btn', initialProps: {} } } as never, mkDragEvent('dragstart', { setData: vi.fn() } as any));
    fired('drop', { ...mkDragEvent('drop'), clientX: 200, clientY: 80 });
    // The drop event fires after the gesture commits. The
    // dropTarget may be null (no sensor registered) but the
    // event itself should fire.
    expect(seen.length).toBe(1);
  });

  it('dragend (dropped outside any target) fires cancelBoost', () => {
    const seen: Array<{ meta?: unknown }> = [];
    dragon.events.on('cancelBoost', (e) => seen.push({ meta: (e as { meta?: unknown }).meta }));
    dragon.boost({ type: 'NodeData', data: { componentName: 'Btn', initialProps: {} } } as never, mkDragEvent('dragstart', { setData: vi.fn() } as any));
    fired('dragend', mkDragEvent('dragend'));
    expect(seen.length).toBe(1);
  });

  it('drop then dragend — dragend is a no-op (the gesture is already closed)', () => {
    const cancels: number[] = [];
    const drops: number[] = [];
    dragon.events.on('cancelBoost', () => cancels.push(Date.now()));
    dragon.events.on('dropBoost', () => drops.push(Date.now()));
    dragon.boost({ type: 'NodeData', data: { componentName: 'Btn', initialProps: {} } } as never, mkDragEvent('dragstart', { setData: vi.fn() } as any));
    fired('drop', { ...mkDragEvent('drop'), clientX: 200, clientY: 80 });
    fired('dragend', mkDragEvent('dragend'));
    expect(drops.length).toBe(1);
    expect(cancels.length).toBe(0); // dragend AFTER drop is a no-op
  });

  it('boost from a MouseEvent uses the mouse path (no HTML5 listeners)', () => {
    dragon.boost({ type: 'NodeData', data: { componentName: 'Test', initialProps: {} } } as never, { type: 'mousedown', clientX: 10, clientY: 10, altKey: false, ctrlKey: false, button: 0 } as unknown as MouseEvent);
    expect(listeners.get('drop')?.size ?? 0).toBe(0);
    expect(listeners.get('dragend')?.size ?? 0).toBe(0);
    // Mouse path: mousedown / mouseup / keydown listeners.
    expect(listeners.get('mousemove')?.size ?? 0).toBeGreaterThan(0);
    expect(listeners.get('mouseup')?.size ?? 0).toBeGreaterThan(0);
  });

  it('effectAllowed assignment failure (try/catch) does not break dispatch', () => {
    const setData = vi.fn();
    const dt = {
      get effectAllowed() { return ''; },
      set effectAllowed(_v: string) { throw new Error('not allowed'); },
      setData,
    } as unknown as DataTransfer;
    const ev = mkDragEvent('dragstart', dt as any);
    expect(() => dragon.boost({ type: 'NodeData', data: { componentName: 'T', initialProps: {} } } as never, ev)).not.toThrow();
    expect(setData).toHaveBeenCalled();
  });

  it('setData failure (try/catch) does not break dispatch', () => {
    const dt = {
      effectAllowed: 'all',
      setData: vi.fn(() => { throw new Error('setData not allowed'); }),
    } as unknown as DataTransfer;
    const ev = mkDragEvent('dragstart', dt as any);
    expect(() => dragon.boost({ type: 'NodeData', data: { componentName: 'T', initialProps: {} } } as never, ev)).not.toThrow();
    expect(dt.setData).toHaveBeenCalled();
  });

  it('teardown after drop removes the drop + dragend listeners', () => {
    dragon.boost({ type: 'NodeData', data: { componentName: 'T', initialProps: {} } } as never, mkDragEvent('dragstart', { setData: vi.fn() } as any));
    expect(listeners.get('drop')?.size ?? 0).toBe(1);
    expect(listeners.get('dragend')?.size ?? 0).toBe(1);
    fired('drop', { ...mkDragEvent('drop'), clientX: 200, clientY: 80 });
    expect(listeners.get('drop')?.size ?? 0).toBe(0);
    expect(listeners.get('dragend')?.size ?? 0).toBe(0);
  });
});
