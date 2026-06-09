/**
 * @monbolc/lowcode-designer — ComponentMetaLite + Registry tests
 * Ali-mirror Phase E.3.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  ComponentMetaLite,
  ComponentMetaRegistry,
  type IComponentMetaLite,
} from '../src/component-meta';

describe('ComponentMetaLite (Phase E.3)', () => {
  it('default isComponentMeta: true discriminator', () => {
    const m = new ComponentMetaLite();
    expect(m.isComponentMeta).toBe(true);
  });

  it('sets + reads title, rootSelector, npm, availableActions, liveTextEditing, advanced', () => {
    const m = new ComponentMetaLite();
    m.title = 'MyButton';
    m.rootSelector = '.btn';
    m.npm = { package: 'antd', componentName: 'Button' };
    m.availableActions = [{ name: 'copy', important: true, content: null }];
    m.liveTextEditing = [{ propTarget: 'children' }];
    m.advanced = { hideSelectTools: false, isAbsoluteLayoutContainer: false };
    expect(m.title).toBe('MyButton');
    expect(m.rootSelector).toBe('.btn');
    expect(m.npm).toEqual({ package: 'antd', componentName: 'Button' });
    expect(m.availableActions?.length).toBe(1);
    expect(m.liveTextEditing?.length).toBe(1);
    expect(m.advanced?.hideSelectTools).toBe(false);
  });

  it('getMetadata: returns a plain object carrying the slim surface (not the class instance)', () => {
    // Slim port: getMetadata returns the _metadata object (a plain object),
    // NOT the ComponentMetaLite class instance. This avoids the
    // recursive-setter bug that would occur if _metadata === this.
    // Ali-faithful returns `this`; the slim port returns the inner
    // object so setters don't recurse.
    const m = new ComponentMetaLite();
    const meta = m.getMetadata();
    expect(meta).not.toBe(m);
    expect(meta.isComponentMeta).toBe(true);
    expect(typeof meta).toBe('object');
  });

  it('setMetadata: replaces the current meta and emits onMetadataChange', () => {
    const m = new ComponentMetaLite();
    const fn = vi.fn();
    m.onMetadataChange(fn);
    const other = new ComponentMetaLite();
    m.setMetadata(other);
    expect(m.getMetadata()).toBe(other);
    expect(fn).toHaveBeenCalled();
  });

  it('onMetadataChange: disposer stops the subscription', () => {
    const m = new ComponentMetaLite();
    const fn = vi.fn();
    const off = m.onMetadataChange(fn);
    off();
    m.setMetadata(new ComponentMetaLite());
    expect(fn).not.toHaveBeenCalled();
  });
});

describe('ComponentMetaRegistry (Phase E.3)', () => {
  it('register + getComponentMeta: round-trips a meta by name', () => {
    const r = new ComponentMetaRegistry();
    const m = new ComponentMetaLite();
    m.title = 'Button';
    r.register('Button', m);
    expect(r.getComponentMeta('Button')).toBe(m);
  });

  it('getComponentMeta: returns undefined for absent names (slim: no auto-build)', () => {
    const r = new ComponentMetaRegistry();
    expect(r.getComponentMeta('NotRegistered')).toBeUndefined();
  });

  it('has: true for registered, false for absent', () => {
    const r = new ComponentMetaRegistry();
    r.register('A', new ComponentMetaLite());
    expect(r.has('A')).toBe(true);
    expect(r.has('B')).toBe(false);
  });

  it('unregister: removes a meta; no-op if absent', () => {
    const r = new ComponentMetaRegistry();
    r.register('A', new ComponentMetaLite());
    r.unregister('A');
    expect(r.has('A')).toBe(false);
    expect(() => r.unregister('B')).not.toThrow();
  });

  it('values: iterates all registered metas (used by configure-panel)', () => {
    const r = new ComponentMetaRegistry();
    r.register('A', new ComponentMetaLite());
    r.register('B', new ComponentMetaLite());
    const all = Array.from(r.values());
    expect(all.length).toBe(2);
  });

  it('onRegister: subscribes to registration events', () => {
    const r = new ComponentMetaRegistry();
    const fn = vi.fn();
    r.onRegister(fn);
    r.register('A', new ComponentMetaLite());
    expect(fn).toHaveBeenCalledWith('A');
  });
});

describe('Integration: BorderSelecting.availableActions surface (Phase E.3 unblock)', () => {
  it('IComponentMetaLite carries the fields BorderSelecting.Toolbar reads', () => {
    const m = new ComponentMetaLite();
    m.title = 'Card';
    m.rootSelector = '.card';
    m.npm = { package: 'antd', componentName: 'Card' };
    m.availableActions = [
      { name: 'copy', important: true, content: null },
      { name: 'remove', important: true, content: null },
    ];
    m.advanced = { hideSelectTools: false };
    // Ali-faithful structural check: the fields BorderSelecting reads
    // via structural cast are now typed via IComponentMetaLite.
    const surface: Partial<IComponentMetaLite> = m;
    expect(surface.title).toBe('Card');
    expect(surface.rootSelector).toBe('.card');
    expect(surface.npm?.componentName).toBe('Card');
    expect(surface.availableActions?.length).toBe(2);
    expect(surface.advanced?.hideSelectTools).toBe(false);
  });
});
