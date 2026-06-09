/**
 * @monbolc/lowcode-designer — D.I7 infra tests
 * Tests for `DocumentModel.dropLocation` and `BuiltinSimulatorHost.createOffsetObserver`.
 */
import { describe, it, expect } from 'vitest';
import { DocumentModel } from '../../src/document';
import { Project } from '../../src/project';
import { BuiltinSimulatorHost } from '../../src/simulator-host';

describe('DocumentModel.dropLocation (Phase D.I7)', () => {
  it('initial value is null', () => {
    const doc = new DocumentModel({ componentName: 'Page' } as never);
    expect(doc.dropLocation).toBeNull();
  });
  it('setDropLocation updates the value', () => {
    const doc = new DocumentModel({ componentName: 'Page' } as never);
    doc.setDropLocation({ target: { id: 'a' }, detail: { type: 'children' } });
    expect(doc.dropLocation).toEqual({ target: { id: 'a' }, detail: { type: 'children' } });
  });
  it('setDropLocation(null) clears the value', () => {
    const doc = new DocumentModel({ componentName: 'Page' } as never);
    doc.setDropLocation({ target: { id: 'a' } });
    doc.setDropLocation(null);
    expect(doc.dropLocation).toBeNull();
  });
});

describe('BuiltinSimulatorHost.createOffsetObserver (Phase D.I7)', () => {
  it('returns a minimal stub with the expected fields', () => {
    const project = new Project({ componentName: 'Page' } as never);
    const host = new BuiltinSimulatorHost(
      project,
      { canvas: document.createElement('div') },
    );
    const node = project.document.root;
    const observer = (host as unknown as { createOffsetObserver: (o: { node: unknown; instance: unknown }) => unknown }).createOffsetObserver({ node, instance: null });
    expect(observer).toBeDefined();
    const o = observer as { id: string; hasOffset: boolean; offsetWidth: number; offsetHeight: number; offsetTop: number; offsetLeft: number; node: unknown; purge: () => void };
    expect(typeof o.id).toBe('string');
    expect(o.hasOffset).toBe(false);
    expect(o.offsetWidth).toBe(0);
    expect(o.offsetHeight).toBe(0);
    expect(o.offsetTop).toBe(0);
    expect(o.offsetLeft).toBe(0);
    expect(o.node).toBe(node);
    expect(typeof o.purge).toBe('function');
    expect(() => o.purge()).not.toThrow();
  });
});
