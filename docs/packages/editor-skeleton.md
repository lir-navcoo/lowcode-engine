# `@monbolc/lowcode-editor-skeleton` (L4)

> **Version**: 2.2.0 · **Uses `react-resizable-panels`** · **21 tests / 5 files** · **画布可替换 widget 抽象 (P2.2)**

## Purpose

The 3-pane editor UI: left (Outline) / center (canvas) / right (Settings). The L4 surface that users actually interact with. End-to-end demo `examples/hello-sapu.html` uses the real `Skeleton`.

## Public exports

### React components
- `Skeleton` + `SkeletonProps` — 3-pane layout, accepts an optional `designerView` slot
- `DefaultDesignerView` + `DesignerViewProps` — the built-in canvas (Simulator + Overlays + BuiltinSimulatorHost). Hosts can also render this directly to bypass `<Skeleton>`'s 3-pane layout
- `SettingsPanel` + `SettingsPanelProps` — right-side properties editor
- `Overlays` + `OverlaysProps` — DOM-level overlay manager (returns `null`, writes directly to `canvasContainer`)

### Types
- `DesignerViewHelpers` — what `designerView(helpers)` receives from the host-facing `Skeleton.designerView` prop

## Key types

```ts
interface SkeletonProps {
  project: Project;                                    // from @monbolc/lowcode-designer
  components: Record<string, unknown>;
  leftSize?: number;                                   // default 20
  rightSize?: number;                                  // default 24
  onPaneReady?: (pane: OutlinePane) => void;
  setterConfig?: Record<string, Record<string, string>>;
  componentMeta?: Record<string, Record<string, unknown>>;
  topArea?: () => React.ReactNode;
  leftArea?: () => React.ReactNode;
  leftView?: 'outline' | 'components';
  onLeftViewChange?: (view: 'outline' | 'components') => void;
  designerView?: (helpers: DesignerViewHelpers) => React.ReactNode;  // P2.2
}

interface DesignerViewHelpers {
  project: Project;
  components: Record<string, unknown>;
  setterConfig?: Record<string, Record<string, string>>;
  componentMeta?: Record<string, Record<string, unknown>>;
}

interface DesignerViewProps extends DesignerViewHelpers {
  canvasClassName?: string;          // 覆盖外层默认 Tailwind class
  canvasInnerClassName?: string;     // 覆盖内层默认 Tailwind class (含 `relative` 定位)
}
```

## Implementation patterns

- **3-pane layout** via `react-resizable-panels`: left (Outline) / center (canvas) / right (Settings)
- `Skeleton` mirrors the project's `document.root` into a local `OutlinePane` instance via `useEffect`. Subscribes to `document.events` and re-calls `pane.setSchema(...)` on every event
- **画布是抽离的 widget**（P2.2）：`Skeleton` 不再硬编码 Simulator / Overlays / BuiltinSimulatorHost — `designerView` 不传时用 `<DefaultDesignerView>`，传了则用 host 的实现
- `DefaultDesignerView` 内部走 3 个 useEffect：document events 订阅 → 增量 `root.render()`、Simulator mount/unmount（`queueMicrotask` 防 React 19 同步冲突）、BuiltinSimulatorHost 生命周期
- **`h()()` resolver** in all `.tsx` files: `const h = () => adapter.getRuntime().createElement as ...`
- **Inline Tailwind v4 utility classes**（无 inline style、无 CSS-in-JS、无全局 stylesheet 注入）— 取代了原来的 `<style>` 块和 `STYLES` 字符串
- **Imperative overlay rendering** in `Overlays.tsx`: returns `null`, writes DOM directly into `canvasContainer`. 4 类 overlay（border / hover / ghost / insertion-indicator）由 `MutationObserver` 触发重画
- **`useRev` 已删除**（P2.2 前置清理）— 改为精确的 `useEffect` + `emitter.on/off` 订阅，列出每个 event name，避免无差别 repaint
- **Settings panel** 通过 `setter-resolver.tsx` 抽象层消费 `@monbolc/lowcode-plugin-setters`，**不直接 import** 该包的具体实现
- 所有 `sapu-*` class name（如 `sapu-border-overlay`）是稳定的 test selector

## 画布可替换 (P2.2)

`<Skeleton>` 接受一个 `designerView?: (helpers) => ReactNode` prop。host 不传时用 `<DefaultDesignerView>`（Simulator + Overlays + BuiltinSimulatorHost 三件套）；传了则完全接管画布区域。

**最小可行示例**（10 行，host 写一个 iframe 隔离的画布）:

```tsx
import { Skeleton, BuiltinSimulatorHost, Simulator } from '@monbolc/lowcode-engine';

<Skeleton
  project={project}
  components={components}
  designerView={({ project, components }) => (
    <iframe
      ref={(el) => {
        if (!el) return;
        const inner = el.contentDocument!.body;
        const root = new Simulator(project.document.root, { components });
        inner.appendChild(document.createElement('div'));
        // ... mount React tree in iframe
      }}
    />
  )}
/>
```

**替换视图必须自行**:
1. 渲染 `project.document.root`（用 `<Simulator>` 或自己的渲染器）
2. 给画布节点打 `data-lce-id` 属性（`<Overlays>` 用它定位选中框）
3. 在画布节点上挂 pointer 事件 → dragon（可以直接 `new BuiltinSimulatorHost(project, { canvas })`）

**不要做什么**:
- 不要把 `data-lce-id` 当私有 — `<Overlays>` 公开依赖它
- 不要假设有"中央 widget 注册表" — Sapu 立场是"组件级 prop 直接暴露"，`<Skeleton>` 的 `designerView` 就是那个出口

## Test coverage

- 5 test files, 21 tests
- `designer-view.test.tsx` (6) — `<DefaultDesignerView>` 独立行为：默认 class、override、Simulator mount、document events、project swap、BuiltinSimulatorHost 生命周期
- `skeleton.test.tsx` (12) — 3-pane headers、Project 暴露、Overlays 不抛、leftArea 视图切换、controlled 模式、`designerView` slot 3 case（默认/host 接管/helpers 透传）
- `overlays.test.tsx` (5+) — border / drag-ghost / ghost-cleared / insertion-indicator / MutationObserver 触发重画
- `settings-panel.test.tsx` (3) — empty hint、props visible、click-to-edit + Enter commits
- `widgets.test.tsx` (~6) — `SapuModal` / `SapuFloatingPanel` / `SapuToaster` UI 原子
- `e2e.test.tsx` (5) — L0–L4 端到端 mount + 选中 + edit cycle 持久化

## External deps

- `@monbolc/lowcode-types`, `@monbolc/lowcode-utils`, `@monbolc/lowcode-renderer-core`, `@monbolc/lowcode-react-renderer`, `@monbolc/lowcode-designer`, `@monbolc/lowcode-plugin-outline-pane`, `@monbolc/lowcode-plugin-setters` (workspace)
- `react-resizable-panels` (runtime) — **the only package that imports this**
- `react`, `react-dom` (optional peer)

## Missing from upstream port

- `Workbench` — tabbed UI for multiple editor views
- `Widget`/`Panel`/`Dock`/`DialogDock`/`Stage` — widget 原语（Sapu 主动放弃，改用 prop-driven 风格）
- `PopupService` — singleton for drawer/popup management（host 自己管数组）
- `createField` — field factory that picks `PopupField`/`EntryField`/...（sapu 用 setter 体系代替）
- 9 `Area` types — Sapu 暴露 `topArea` / `leftArea` / `designerView` 三个 prop 即可

## See also

- [../ARCHITECTURE.md](../ARCHITECTURE.md) — L4 design + React injection boundary
- [../ROADMAP.md](../ROADMAP.md) — P2.2 (画布可替换), P2.3 (UI 原子 widgets)
- [../COMPARISON-WITH-ALI.md](../COMPARISON-WITH-ALI.md) — upstream `plugin-designer` 157 行已被 `DefaultDesignerView` 吸收
- [`examples/hello-sapu.html`](../../examples/hello-sapu.html) — the real demo using the real `Skeleton`
