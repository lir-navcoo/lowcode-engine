import { describe, it, expect } from 'vitest';
import { adapter } from '../src/adapter';
import type { IRenderComponent, IRuntime } from '../src/types';

const validRuntime: IRuntime = {
  Component: class C { setState() { /* */ } forceUpdate() { /* */ } render() { return null; } },
  PureComponent: class P { setState() { /* */ } forceUpdate() { /* */ } render() { return null; } },
  createElement: () => null,
  createContext: () => ({ Provider: () => null }),
  forwardRef: (fn: unknown) => fn,
  findDOMNode: () => null,
};

describe('Adapter', () => {
  it('starts with a stub runtime', () => {
    adapter.initRuntime();
    const r = adapter.getRuntime();
    expect(typeof r.Component).toBe('function');
    expect(typeof r.createElement).toBe('function');
  });

  it('setRuntime validates required modules', () => {
    adapter.initRuntime();
    expect(() => adapter.setRuntime({ ...validRuntime, Component: undefined as never })).toThrow();
  });

  it('setRuntime accepts a valid runtime', () => {
    adapter.initRuntime();
    adapter.setRuntime(validRuntime);
    expect(adapter.getRuntime()).toBe(validRuntime);
    expect(adapter.isReact()).toBe(true);
  });

  it('setRenderers + getRenderers round-trip', () => {
    adapter.initRuntime();
    const fakeRenderer: IRenderComponent = class {} as never;
    adapter.setRenderers({ PageRenderer: fakeRenderer });
    expect(adapter.getRenderers().PageRenderer).toBe(fakeRenderer);
  });

  it('pickRenderer returns Page for Page, Component for everything else', () => {
    adapter.initRuntime();
    const PageC: IRenderComponent = class {} as never;
    const CompC: IRenderComponent = class {} as never;
    const BlockC: IRenderComponent = class {} as never;
    adapter.setRenderers({ PageRenderer: PageC, ComponentRenderer: CompC, BlockRenderer: BlockC });
    expect(adapter.pickRenderer({ componentName: 'Page' })).toBe(PageC);
    expect(adapter.pickRenderer({ componentName: 'Block' })).toBe(BlockC);
    expect(adapter.pickRenderer({ componentName: 'Anything' })).toBe(CompC);
    expect(adapter.pickRenderer({ componentName: '' })).toBe(CompC);
  });

  it('setConfigProvider + getConfigProvider round-trip', () => {
    adapter.initRuntime();
    const fakeConfig = { tag: 'config' };
    adapter.setConfigProvider(fakeConfig);
    expect(adapter.getConfigProvider()).toBe(fakeConfig);
  });
});
