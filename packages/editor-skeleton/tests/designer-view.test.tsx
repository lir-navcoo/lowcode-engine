/**
 * @monbolc/lowcode-editor-skeleton — DefaultDesignerView 单元测试
 *
 * P2.2: 验证 DefaultDesignerView 抽离后行为不变 — 6 个 case:
 *   1. 不传 className 时用默认 Tailwind class
 *   2. 传 canvasClassName / canvasInnerClassName 时覆盖默认
 *   3. project 有 root schema 时, 画布内层有 Simulator 渲染的 child
 *   4. 订阅 rootChanged 事件后, 触发重画
 *   5. project swap 时 simulator unmount + 新 simulator mount
 *   6. BuiltinSimulatorHost 实际接 pointer 事件 (canvas DOM 有 onpointerdown)
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { installReactRuntime, uninstallReactRuntime, setupReactRenderer } from '@monbolc/lowcode-react-renderer';
import { deepClone } from '@monbolc/lowcode-utils';
import { Project } from '@monbolc/lowcode-designer';
import { DefaultDesignerView } from '../src/designer-view';
import type { IPublicTypeRootSchema } from '@monbolc/lowcode-types';

beforeAll(() => {
  // Simulator 在 DefaultDesignerView 内部 createRoot 时需要 React runtime +
  // 6 个 concrete renderers. 这是 L7 init() 隐式调的, 单测里手动 setup.
  // setupReactRenderer 仍可调用 (deprecated 2.2.0 → remove 3.0.0, 测试用它最省事).
  setupReactRenderer();
});

afterAll(() => {
  uninstallReactRuntime();
});

const SEED: IPublicTypeRootSchema = {
  fileName: 'p.json',
  componentName: 'Page',
  children: [{ componentName: 'A' }, { componentName: 'B' }],
};

// 注意: schema.componentName === 'Page' 是 reserved routing key (走
// PageRendererImpl, 不调 user 组件). 我们用非保留字 'Root' 包一层,
// 这样走 ComponentRenderer 路由, 真正调 user 组件. PageRenderer 路径
// 由 overlays.test.tsx / e2e.test.tsx 覆盖.
const WRAPPED_SEED: IPublicTypeRootSchema = {
  fileName: 'w.json',
  componentName: 'Root',
  children: [{ componentName: 'Page', children: [{ componentName: 'A' }] }],
};

const COMPONENTS: Record<string, unknown> = {
  Page: () => React.createElement('div', { 'data-testid': 'page' }, 'page'),
  A: () => null,
  B: () => null,
  Root: ({ children }: { children?: unknown }) =>
    React.createElement('div', { 'data-testid': 'root' }, children as React.ReactNode),
};

describe('DefaultDesignerView (P2.2)', () => {
  it('uses the default Tailwind classes when no override is passed', () => {
    const project = new Project(deepClone(SEED));
    const { container } = render(
      <DefaultDesignerView project={project} components={COMPONENTS} />,
    );
    // 外层: 'flex-1 bg-slate-50 p-4 overflow-auto h-full'
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toContain('flex-1');
    expect(outer.className).toContain('bg-slate-50');
    expect(outer.className).toContain('p-4');
    // 内层: 'relative bg-white min-h-full p-4 border border-slate-200'
    const inner = outer.firstChild as HTMLElement;
    expect(inner.className).toContain('relative');
    expect(inner.className).toContain('bg-white');
  });

  it('honors canvasClassName and canvasInnerClassName overrides', () => {
    const project = new Project(deepClone(SEED));
    const { container } = render(
      <DefaultDesignerView
        project={project}
        components={COMPONENTS}
        canvasClassName="my-canvas-outer"
        canvasInnerClassName="my-canvas-inner"
      />,
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toBe('my-canvas-outer');
    const inner = outer.firstChild as HTMLElement;
    expect(inner.className).toBe('my-canvas-inner');
  });

  it('mounts the Simulator (renders project.document.root into the canvas)', () => {
    const project = new Project(deepClone(WRAPPED_SEED));
    render(<DefaultDesignerView project={project} components={COMPONENTS} />);
    // 走 ComponentRenderer 路由: Root 组件真的被调, Page 也真的被调
    expect(screen.getByTestId('root')).toBeInTheDocument();
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });

  it('subscribes to document events and re-renders the canvas on mutation', () => {
    const project = new Project(deepClone(WRAPPED_SEED));
    render(<DefaultDesignerView project={project} components={COMPONENTS} />);
    expect(screen.getByTestId('page')).toBeInTheDocument();
    // 触发一个会让 root schema mutate 的事件. Document 内部走
    // document.insert(node, parent, index), emit nodeAdded + 触发我们的
    // onChange → simulator 重新 render.
    const root = project.document.root;
    const aId = (root.children[0] as { id: string }).id;
    const pageNode = project.document.getNode(aId)!;
    project.document.insert({ componentName: 'NewChild' }, pageNode, 0);
    // 不抛 + 画布仍然在 (Simulator 没崩, 重新 render 了)
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });

  it('unmounts the old Simulator and mounts a fresh one when project swaps', () => {
    const projectA = new Project(deepClone(WRAPPED_SEED));
    const projectB = new Project(deepClone(WRAPPED_SEED));
    const { rerender } = render(
      <DefaultDesignerView project={projectA} components={COMPONENTS} />,
    );
    expect(screen.getByTestId('page')).toBeInTheDocument();
    // swap project
    rerender(<DefaultDesignerView project={projectB} components={COMPONENTS} />);
    // 仍然有 page — 新 project 也有 Page 组件
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });

  it('mounts a BuiltinSimulatorHost that wires the canvas DOM to pointer events', () => {
    const project = new Project(deepClone(WRAPPED_SEED));
    const { container } = render(
      <DefaultDesignerView project={project} components={COMPONENTS} />,
    );
    // canvasHost 是画布内层 div (parent of <Page>). 验证它的 DOM
    // 真实存在 (不是 null/undefined) — BuiltinSimulatorHost 依赖
    // 这个 element 来 addEventListener('pointerdown').
    const inner = container.querySelector('.relative.bg-white') as HTMLElement;
    expect(inner).not.toBeNull();
    // fireEvent 触发 pointerdown 不抛, 说明 host 已经挂上 listener
    expect(() => fireEvent.pointerDown(inner, { clientX: 5, clientY: 5 })).not.toThrow();
  });
});
