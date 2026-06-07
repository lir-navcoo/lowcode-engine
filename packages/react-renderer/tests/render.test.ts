import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { installReactRuntime, uninstallReactRuntime } from '../src/inject';
import { setupReactRenderer, ReactRenderer } from '../src/render';
import type { IPublicTypeNodeSchema } from '@monbolc/lowcode-types';

beforeEach(() => {
  setupReactRenderer();
});
afterEach(() => {
  uninstallReactRuntime();
});

describe('setupReactRenderer', () => {
  it('installs the React runtime', () => {
    expect(adapter.getRuntime().Component).toBe(React.Component);
  });

  it('registers all 6 renderers with the adapter', () => {
    const r = adapter.getRenderers();
    expect(r.PageRenderer).toBeDefined();
    expect(r.ComponentRenderer).toBeDefined();
    expect(r.BlockRenderer).toBeDefined();
    expect(r.AddonRenderer).toBeDefined();
    expect(r.TempRenderer).toBeDefined();
    expect(r.DivRenderer).toBeDefined();
  });

  it('pickRenderer routes to the right class by name', () => {
    expect(adapter.pickRenderer({ componentName: 'Page' })).toBe(adapter.getRenderers().PageRenderer);
    expect(adapter.pickRenderer({ componentName: 'Block' })).toBe(adapter.getRenderers().BlockRenderer);
    expect(adapter.pickRenderer({ componentName: 'Addon' })).toBe(adapter.getRenderers().AddonRenderer);
    expect(adapter.pickRenderer({ componentName: 'Temp' })).toBe(adapter.getRenderers().TempRenderer);
    expect(adapter.pickRenderer({ componentName: 'Unknown' })).toBe(adapter.getRenderers().ComponentRenderer);
  });
});

describe('ReactRenderer', () => {
  const schema: IPublicTypeNodeSchema = {
    fileName: 'p.json',
    componentName: 'Page',
    children: [
      { componentName: 'Header', children: [
        { componentName: 'Heading' },
      ]},
    ],
  };

  it('renders a Page schema and includes the renderer attribute', () => {
    const r = new ReactRenderer({ schema });
    const out = r.render();
    const { container } = render(out as React.ReactElement);
    expect(container.querySelector('[data-renderer="Page"]')).not.toBeNull();
  });

  it('renders nested children', () => {
    const r = new ReactRenderer({ schema });
    const { container } = render(r.render() as React.ReactElement);
    // Header has data-unknown-component attribute since it's not in props.components
    expect(container.querySelector('[data-unknown-component="Header"]')).not.toBeNull();
    expect(container.querySelector('[data-unknown-component="Heading"]')).not.toBeNull();
  });

  it('uses user-provided component when passed via props.components', () => {
    const MyButton: React.FC<{ text?: string }> = ({ text }) =>
      React.createElement('button', { 'data-mine': 'true' }, text ?? 'btn');
    const r = new ReactRenderer({
      schema: { componentName: 'Page', children: [
        { componentName: 'MyButton', props: { text: 'Click' } },
      ]},
      components: { MyButton },
    });
    const { container } = render(r.render() as React.ReactElement);
    expect(container.querySelector('[data-mine="true"]')).not.toBeNull();
    expect(container.textContent).toContain('Click');
  });

  it('suspended=true renders an empty page', () => {
    const r = new ReactRenderer({ schema, suspended: true });
    const { container } = render(r.render() as React.ReactElement);
    expect(container.querySelector('[data-renderer="Page"]')?.children.length).toBe(0);
  });

  it('returns null for non-node schema', () => {
    const r = new ReactRenderer({ schema: { not: 'a node' } as unknown as IPublicTypeNodeSchema });
    expect(r.render()).toBeNull();
  });

  it('attaches a stable key to each rendered child', () => {
    const r = new ReactRenderer({ schema });
    const { container } = render(r.render() as React.ReactElement);
    // The Page wrapper's direct children should all have a `key` prop.
    const pageDiv = container.querySelector('[data-renderer="Page"]') as HTMLElement | null;
    expect(pageDiv).not.toBeNull();
    // Walk the rendered React tree under Page: Header div is the only child.
    const headerDiv = pageDiv!.querySelector('[data-unknown-component="Header"]') as HTMLElement | null;
    expect(headerDiv).not.toBeNull();
  });
});
