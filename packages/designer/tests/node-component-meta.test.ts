/**
 * @monbolc/lowcode-designer — Node + typed componentMeta tests
 * Ali-mirror Phase E.5.
 */
import { describe, it, expect } from 'vitest';
import { Node } from '../src/node';
import { ComponentMetaLite } from '../src/component-meta';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

function mkNode(id: string = 'a'): Node {
  return new Node({ componentName: 'Test', key: id } as IPublicTypeNodeSchema, null);
}

describe('Node + typed componentMeta (Phase E.5)', () => {
  it('default: componentMeta is null (unwired)', () => {
    const n = mkNode();
    expect(n.getComponentMeta()).toBeNull();
  });

  it('setComponentMeta + getComponentMeta: round-trips the meta instance', () => {
    const n = mkNode();
    const m = new ComponentMetaLite();
    m.title = 'Button';
    n.setComponentMeta(m);
    expect(n.getComponentMeta()).toBe(m);
    expect(n.getComponentMeta()?.title).toBe('Button');
  });

  it('setComponentMeta(null) clears the wired meta', () => {
    const n = mkNode();
    n.setComponentMeta(new ComponentMetaLite());
    expect(n.getComponentMeta()).not.toBeNull();
    n.setComponentMeta(null);
    expect(n.getComponentMeta()).toBeNull();
  });

  it('typed surface: BorderDetecting / BorderSelecting fields are accessible', () => {
    const n = mkNode();
    const m = new ComponentMetaLite();
    m.title = 'MyButton';
    m.rootSelector = '.btn';
    m.npm = { package: 'antd', componentName: 'Button' };
    m.advanced = {
      hideSelectTools: false,
      isAbsoluteLayoutContainer: false,
      callbacks: {
        onHoverHook: () => true,
      },
    };
    m.availableActions = [{ name: 'copy', important: true, content: null }];
    n.setComponentMeta(m);
    // Ali-faithful surface reads:
    expect(n.getComponentMeta()?.title).toBe('MyButton');
    expect(n.getComponentMeta()?.rootSelector).toBe('.btn');
    expect(n.getComponentMeta()?.npm?.package).toBe('antd');
    expect(n.getComponentMeta()?.advanced?.callbacks?.onHoverHook?.()).toBe(true);
    expect(n.getComponentMeta()?.availableActions?.length).toBe(1);
  });

  it('typed surface: live-editing liveTextEditing config is accessible', () => {
    const n = mkNode();
    const m = new ComponentMetaLite();
    m.liveTextEditing = [{ propTarget: 'children', mode: 'plaintext' }];
    n.setComponentMeta(m);
    expect(n.getComponentMeta()?.liveTextEditing?.[0]?.propTarget).toBe('children');
    expect(n.getComponentMeta()?.liveTextEditing?.[0]?.mode).toBe('plaintext');
  });

  it('idempotent: setting the same meta twice keeps the same reference', () => {
    const n = mkNode();
    const m = new ComponentMetaLite();
    n.setComponentMeta(m);
    n.setComponentMeta(m);
    expect(n.getComponentMeta()).toBe(m);
  });
});
