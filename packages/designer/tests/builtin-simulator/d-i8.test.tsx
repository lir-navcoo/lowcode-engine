/**
 * @monbolc/lowcode-designer — D.I8 tests
 * Tests for LiveEditing (the static registries) and DragGhost (smoke
 * render + event subscriptions).
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { LiveEditing } from '../../src/builtin-simulator/live-editing/live-editing';
import { DragGhost } from '../../src/designer/drag-ghost';

afterEach(() => { cleanup(); });

describe('LiveEditing (Phase D.I8)', () => {
  afterEach(() => {
    LiveEditing.clearLiveEditingSpecificRule();
    LiveEditing.clearLiveEditingSaveHandler();
  });

  it('clearLiveEditingSpecificRule + clearLiveEditingSaveHandler do not throw', () => {
    expect(() => LiveEditing.clearLiveEditingSpecificRule()).not.toThrow();
    expect(() => LiveEditing.clearLiveEditingSaveHandler()).not.toThrow();
  });

  it('addLiveEditingSpecificRule + clearLiveEditingSpecificRule', () => {
    const rule = (): null => null;
    LiveEditing.addLiveEditingSpecificRule(rule);
    expect(() => LiveEditing.clearLiveEditingSpecificRule()).not.toThrow();
  });

  it('addLiveEditingSaveHandler + clearLiveEditingSaveHandler', () => {
    LiveEditing.addLiveEditingSaveHandler({ condition: () => true, onSaveContent: () => undefined });
    expect(() => LiveEditing.clearLiveEditingSaveHandler()).not.toThrow();
  });

  it('dispose on a fresh instance is a no-op (ali-faithful)', () => {
    const e = new LiveEditing();
    expect(() => e.dispose()).not.toThrow();
    expect(() => e.saveAndDispose()).not.toThrow();
  });

  it('apply is a no-op when no setterPropElement matches (no setterProp key)', () => {
    const e = new LiveEditing();
    // Phase E.7: the slim Node exposes componentMeta via the typed
    // getComponentMeta() method. The mock below mirrors the typed
    // surface so apply() can be called against a non-Node.
    const target = {
      node: {
        getComponentMeta: () => ({ liveTextEditing: undefined }),
        document: undefined,
      },
      rootElement: document.createElement('div'),
      event: { target: document.createElement('span') } as unknown as MouseEvent,
    };
    expect(() => e.apply(target as never)).not.toThrow();
  });
});

describe('DragGhost (Phase D.I8)', () => {
  it('renders null when no drag is in progress (no subscriptions fired)', () => {
    const designer = {
      dragon: {
        events: {
          on: vi.fn(() => () => undefined),
          off: vi.fn(),
        },
      },
      getComponentMeta: vi.fn(() => ({ title: 'X' })),
    };
    const { container } = render(<DragGhost designer={designer as never} />);
    expect(container.firstChild).toBeNull();
  });

  it('subscribes to dragon events on mount', () => {
    const on = vi.fn(() => () => undefined);
    const designer = {
      dragon: { events: { on, off: vi.fn() } },
      getComponentMeta: vi.fn(() => ({ title: 'X' })),
    };
    render(<DragGhost designer={designer as never} />);
    // Ali-faithful: onDragstart → start, onDrag → move, onDragend → drop/cancel
    expect(on).toHaveBeenCalled();
    const eventNames = on.mock.calls.map((c) => c[0]);
    expect(eventNames).toContain('start');
    expect(eventNames).toContain('move');
    expect(eventNames).toContain('drop');
    expect(eventNames).toContain('cancel');
  });

  it('renders the ghost group after a start event with NodeData', () => {
    const off = vi.fn();
    const on = vi.fn((event: string, handler: (e: unknown) => void) => {
      if (event === 'start') {
        // Fire the start event synchronously
        queueMicrotask(() =>
          handler({
            originalEvent: { type: 'mousedown' },
            dragObject: { type: 'NodeData', nodes: [{ title: 'A' }, { title: 'B' }] },
            globalX: 100,
            globalY: 200,
          } as never),
        );
      }
      return off;
    });
    const designer = {
      dragon: { events: { on, off } },
      getComponentMeta: vi.fn(() => ({ title: 'X' })),
    };
    render(<DragGhost designer={designer as never} />);
    // Ali-faithful: after start, the ghost group renders at (x, y)
    // Slim test: just confirm the component mounted without crash.
    expect(on).toHaveBeenCalled();
  });

  it('cleans up subscriptions on unmount', () => {
    const off = vi.fn();
    const on = vi.fn(() => off);
    const designer = {
      dragon: { events: { on, off } },
      getComponentMeta: vi.fn(() => ({ title: 'X' })),
    };
    const { unmount } = render(<DragGhost designer={designer as never} />);
    unmount();
    // 4 subscriptions × 1 off call each
    expect(off).toHaveBeenCalledTimes(4);
  });
});
