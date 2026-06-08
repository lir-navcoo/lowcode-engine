/**
 * @monbolc/lowcode-editor-skeleton — DefaultDesignerView
 *
 * Sapu L4 默认画布视图. 把 skeleton.tsx 里 6 处硬编码
 * (imports / rootRef / canvasEl / 2 个 effect / BuiltinSimulatorHost /
 * JSX 出口) 全收进一个文件, 行为字节级一致.
 *
 * host 想完全替换画布时, 传 `designerView={(helpers) => <YourView />}` 给
 * `<Skeleton>`. 不传 → 用 `<DefaultDesignerView>` (Simulator + Overlays +
 * BuiltinSimulatorHost).
 *
 * 替换视图必须自行负责:
 *   1. 渲染 project.document.root (用 Simulator 或自己的渲染器)
 *   2. 给画布节点打 data-lce-id 属性 (Overlays 用它定位)
 *   3. 在画布节点上挂 pointer 事件 → dragon (BuiltinSimulatorHost 即可)
 * 详见 docs/packages/editor-skeleton.md "画布可替换" 节.
 */

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { BuiltinSimulatorHost, DragResizeEngine, Project, Simulator } from '@monbolc/lowcode-designer';

import { Overlays } from './overlays';

/** host 自定义画布时, 通过 `designerView(helpers)` 拿到的 props 子集. */
export interface DesignerViewHelpers {
  project: Project;
  components: Record<string, unknown>;
  setterConfig?: Record<string, Record<string, string>>;
  componentMeta?: Record<string, Record<string, unknown>>;
}

export interface DesignerViewProps extends DesignerViewHelpers {
  /** 自定义画布容器类名. 默认 `flex-1 bg-slate-50 p-4 overflow-auto h-full`. */
  canvasClassName?: string;
  /** 自定义画布内层容器类名. 默认 `relative bg-white min-h-full p-4 border border-slate-200`. */
  canvasInnerClassName?: string;
}

const CN = {
  // 外层: 灰底 + padding + 滚动条
  canvas: 'flex-1 bg-slate-50 p-4 overflow-auto h-full',
  // 内层: 白卡 + `relative` 是 load-bearing — Overlays 把自己 appendChild
  // 进来, 失去 relative 定位会让 selection border 跑到 <body>.
  canvasInner: 'relative bg-white min-h-full p-4 border border-slate-200',
} as const;

export function DefaultDesignerView(props: DesignerViewProps): ReactNode {
  // canvasHost 唯一用处: 第二个 useEffect mount Simulator 时读它的 current.
  // 之后 simulator 自己管 DOM, 不再需要这个 ref.
  const canvasHost = useRef<HTMLDivElement | null>(null);
  // Stash 第二个 useEffect 创建的 React root + container, 让第一个 useEffect
  // 监听 document 事件后能调用 `root.render(...)` 增量重画.
  const rootRef = useRef<{ root: Root; container: HTMLDivElement } | null>(null);
  // canvasEl 是 state (不是 ref) — 第三个 useEffect (mount BuiltinSimulatorHost)
  // 依赖它, 这样 React 真的把 DOM 节点挂上去了才会触发.
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const setCanvasRef = (el: HTMLDivElement | null): void => {
    canvasHost.current = el;
    setCanvasEl(el);
  };

  // 订阅 document 事件 → 增量重画 simulator. Document 在原位 mutate schema
  // (root 引用不变), 这个 effect 必须在 deps `[project, components]` 触发之外
  // 也能跑, 否则画布会停在旧状态.
  useEffect(() => {
    const onChange = (): void => {
      const r = rootRef.current;
      if (r) {
        const sim = new Simulator(props.project.document.root, { components: props.components });
        r.root.render(sim.render() as ReactNode);
      }
    };
    const ev = props.project.document.events;
    const names = ['rootChanged', 'nodeAdded', 'nodeRemoved', 'nodeMoved', 'nodeRenamed', 'nodePropsChanged'] as const;
    names.forEach((n) => ev.on(n, onChange));
    return () => {
      names.forEach((n) => ev.off(n, onChange));
    };
  }, [props.project, props.components]);

  // mount / unmount Simulator. 这个 effect 只在 project 整体换时跑 —
  // 增量 mutation 由上一个 effect 处理.
  useEffect(() => {
    if (!canvasHost.current) return;
    const sim = new Simulator(props.project.document.root, { components: props.components });
    canvasHost.current.innerHTML = '';
    const inner = document.createElement('div');
    canvasHost.current.appendChild(inner);
    const root: Root = createRoot(inner);
    root.render(sim.render() as Parameters<typeof root.render>[0]);
    rootRef.current = { root, container: inner };
    return () => {
      // React 19: 同步 unmount 会在另一个组件 commit 中冲突 —
      // "Attempted to synchronously unmount a root while React was already
      // rendering" 在 schema 变更 (add footer 等) 时会触发.
      queueMicrotask(() => {
        root.unmount();
        if (rootRef.current?.root === root) rootRef.current = null;
      });
    };
  }, [props.project.document.root, props.components]);

  // 挂 BuiltinSimulatorHost — 把 canvas DOM 的 pointer 事件桥接到 Dragon.
  // Host 自己不创建 DOM, 只挂监听, 所以 cleanup 极简.
  //
  // P9.2: also create a DragResizeEngine per canvas mount and
  // pass it to <Overlays>. The Overlays wire each resize
  // handle's pointerdown → engine.start(id, anchor, e). The
  // engine is per-mount (mirrors the BuiltinSimulatorHost
  // lifecycle) and gets GC'd on unmount when the next mount
  // re-creates it.
  useEffect(() => {
    if (!canvasEl) return;
    const host = new BuiltinSimulatorHost(props.project, { canvas: canvasEl });
    host.mount();
    const resizeEngine = new DragResizeEngine({ project: props.project, canvas: canvasEl });
    setEngine(resizeEngine);
    return () => {
      host.unmount();
      resizeEngine.cancel();
      setEngine(null);
    };
  }, [canvasEl, props.project]);

  // P9.2: the engine is created in the mount effect, but <Overlays>
  // needs a stable reference. State-ize it so React re-renders
  // Overlays once the engine exists.
  const [engine, setEngine] = useState<DragResizeEngine | null>(null);

  return (
    <div className={props.canvasClassName ?? CN.canvas}>
      <div className={props.canvasInnerClassName ?? CN.canvasInner} ref={setCanvasRef}>
        <Overlays project={props.project} canvasContainer={canvasEl} resizeEngine={engine} />
      </div>
    </div>
  );
}
