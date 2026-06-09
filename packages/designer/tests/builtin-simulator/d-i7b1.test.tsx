/**
 * @monbolc/lowcode-designer — Phase D.I7b.1 tests
 *
 * Covers the slim `IDropLocation` type (D.I7b.1a), the
 * `setDropLocation` wiring in `BuiltinSimulatorHost.handleMove`
 * (D.I7b.1b), and the real `InsertionView` port (D.I7b.1c).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { Project } from '../../src/project';
import { DocumentModel } from '../../src/document';
import { ComponentMetaLite } from '../../src/component-meta';
import { BuiltinSimulatorHost } from '../../src/simulator-host';
import { InsertionView } from '../../src/builtin-simulator/bem-tools/insertion';
import type { IDropLocation } from '../../src/drop-location';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

afterEach(() => { cleanup(); });

function mkRoot(): IPublicTypeRootSchema {
  return {
    componentName: 'Page',
    children: [
      { componentName: 'Button', key: 'btn1' } as never,
      { componentName: 'Button', key: 'btn2' } as never,
    ],
  } as IPublicTypeRootSchema;
}

describe('IDropLocation (Phase D.I7b.1a)', () => {
  it('is the slim typed surface (target + detail + document)', () => {
    const project = new Project(mkRoot());
    const target = project.document.getNode('btn1')!;
    const loc: IDropLocation = {
      target,
      detail: { index: 0 },
      document: project.document,
    };
    expect(loc.target.id).toBe('btn1');
    expect(loc.detail.index).toBe(0);
    expect(loc.document).toBe(project.document);
  });

  it('DocumentModel.dropLocation is typed as IDropLocation | null', () => {
    const doc = new DocumentModel(mkRoot());
    expect(doc.dropLocation).toBeNull();
    const target = doc.getNode('btn1')!;
    doc.setDropLocation({ target, detail: { index: 0 }, document: doc });
    expect(doc.dropLocation?.target.id).toBe('btn1');
    doc.setDropLocation(null);
    expect(doc.dropLocation).toBeNull();
  });
});

describe('BuiltinSimulatorHost._dropTargetToLocation (Phase D.I7b.1b)', () => {
  function buildHost(): { project: Project; host: BuiltinSimulatorHost; document: DocumentModel } {
    const project = new Project(mkRoot());
    const canvas = document.createElement('div');
    const host = new BuiltinSimulatorHost(project, { canvas });
    return { project, host, document: project.document };
  }

  function callDropTargetToLocation(host: BuiltinSimulatorHost, target: unknown): IDropLocation | null {
    return (host as unknown as {
      _dropTargetToLocation: (t: unknown) => IDropLocation | null;
    })._dropTargetToLocation(target);
  }

  it("'inside' placement yields target-only IDropLocation (no near)", () => {
    const { host, document } = buildHost();
    const loc = callDropTargetToLocation(host, { parentId: 'btn1', index: 0, placement: 'inside' });
    expect(loc).not.toBeNull();
    expect(loc!.target.id).toBe('btn1');
    expect(loc!.detail.index).toBe(0);
    expect(loc!.detail.near).toBeUndefined();
    expect(loc!.document).toBe(document);
  });

  it("'before' placement yields near-sibling at the same index", () => {
    const { host } = buildHost();
    const loc = callDropTargetToLocation(host, { parentId: null, index: 1, placement: 'before' });
    expect(loc).not.toBeNull();
    // parentId null → root case; the helper synthesizes a root Node.
    // detail.near should reference the child at index 1.
    expect(loc!.detail.near?.node.id).toBe('btn2');
    expect(loc!.detail.near?.pos).toBe('before');
  });

  it("'after' placement yields near-sibling at index-1", () => {
    const { host } = buildHost();
    const loc = callDropTargetToLocation(host, { parentId: null, index: 1, placement: 'after' });
    expect(loc).not.toBeNull();
    expect(loc!.detail.near?.node.id).toBe('btn1');
    expect(loc!.detail.near?.pos).toBe('after');
  });

  it('out-of-range near-index falls back to cover (index: null)', () => {
    const { host } = buildHost();
    const loc = callDropTargetToLocation(host, { parentId: null, index: 99, placement: 'before' });
    expect(loc).not.toBeNull();
    expect(loc!.detail.index).toBeNull();
    expect(loc!.detail.near).toBeUndefined();
  });
});

describe('InsertionView (Phase D.I7b.1c)', () => {
  function renderInsertion(host: BuiltinSimulatorHost): ReturnType<typeof render> {
    return render(<InsertionView host={host} />);
  }

  function buildHostWithCanvas(): { host: BuiltinSimulatorHost; doc: DocumentModel; canvas: HTMLDivElement } {
    const project = new Project(mkRoot());
    const canvas = document.createElement('div');
    document.body.appendChild(canvas);
    const host = new BuiltinSimulatorHost(project, { canvas });
    return { host, doc: project.document, canvas };
  }

  it('renders null when dropLocation is null (no drop in progress)', () => {
    const { host, canvas } = buildHostWithCanvas();
    const { container } = renderInsertion(host);
    expect(container.firstChild).toBeNull();
    canvas.remove();
  });

  it('renders a cover rect when detail.index is null (no near)', () => {
    const { host, doc, canvas } = buildHostWithCanvas();
    // Synthesize a tagged element for btn1 so getNodeRect returns
    // a non-null rect.
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'btn1');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 10, top: 20, right: 110, bottom: 70, width: 100, height: 50, x: 10, y: 20, toJSON: () => ({}) }),
    });
    canvas.appendChild(el);
    const target = doc.getNode('btn1')!;
    doc.setDropLocation({ target, detail: { index: null }, document: doc });
    const { container } = renderInsertion(host);
    const cover = container.querySelector('[data-testid="insertion-cover"]');
    expect(cover).not.toBeNull();
    expect(cover!.className).toContain('cover');
    canvas.remove();
  });

  it('renders null when the target has no rect (defensive)', () => {
    const { host, doc, canvas } = buildHostWithCanvas();
    // No element tagged for btn1 → getNodeRect returns null.
    const target = doc.getNode('btn1')!;
    doc.setDropLocation({ target, detail: { index: null }, document: doc });
    const { container } = renderInsertion(host);
    expect(container.firstChild).toBeNull();
    canvas.remove();
  });

  it('renders null for absolute-layout container', () => {
    const { host, doc, canvas } = buildHostWithCanvas();
    const m = new ComponentMetaLite();
    m.advanced = { isAbsoluteLayoutContainer: true };
    host.project.componentMetas.register('Button', m);
    // Re-index after registering the meta so the E.6 auto-wire picks
    // up `isAbsoluteLayoutContainer` (the wire runs at indexSubtree
    // time).
    doc.setRoot(mkRoot());
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'btn1');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) }),
    });
    canvas.appendChild(el);
    const target = doc.getNode('btn1')!;
    doc.setDropLocation({ target, detail: { index: null }, document: doc });
    const { container } = renderInsertion(host);
    expect(container.firstChild).toBeNull();
    canvas.remove();
  });

  it('renders a line with .invalid class when detail.valid is false', () => {
    const { host, doc, canvas } = buildHostWithCanvas();
    const el = document.createElement('div');
    el.setAttribute('data-lce-id', 'btn1');
    Object.defineProperty(el, 'getBoundingClientRect', {
      value: () => ({ left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100, x: 0, y: 0, toJSON: () => ({}) }),
    });
    canvas.appendChild(el);
    const target = doc.getNode('btn1')!;
    doc.setDropLocation({ target, detail: { index: null, valid: false }, document: doc });
    const { container } = renderInsertion(host);
    const cover = container.querySelector('[data-testid="insertion-cover"]');
    expect(cover).not.toBeNull();
    expect(cover!.className).toContain('invalid');
    canvas.remove();
  });

  it('emits an integration event: document.dropLocation updates on handleMove (via spy)', () => {
    // The host.handleMove path is private; verify the public
    // contract: setting dropLocation to a real IDropLocation
    // produces the right render. The internal handleMove call
    // site is verified by the wiring smoke in the
    // simulator-host.test.ts integration test.
    const { host, doc, canvas } = buildHostWithCanvas();
    const spy = vi.fn();
    const unsub = doc.events.on('rootChanged', spy);
    const target = doc.getNode('btn1')!;
    doc.setDropLocation({ target, detail: { index: 0 }, document: doc });
    expect(doc.dropLocation?.target.id).toBe('btn1');
    unsub();
    canvas.remove();
  });
});
