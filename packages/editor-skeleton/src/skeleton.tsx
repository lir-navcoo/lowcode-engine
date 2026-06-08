/**
 * @monbolc/lowcode-editor-skeleton — Skeleton
 *
 * The 3-pane editor layout, powered by react-resizable-panels:
 *   - Left: outline tree (uses plugin-outline-pane)
 *   - Center: simulator (renders the page)
 *   - Right: settings panel (props editor)
 *
 * Pane widths are user-resizable via drag handles between panels.
 *
 * Styling: Tailwind v4 utility classes (see `src/styles.css` for the
 * import). Replaced the previous hand-rolled `<style>` block (the
 * `sapu-skel-*` etc. classes) — that block is gone; the utilities
 * are inlined in the `className` props below.
 */

import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { OutlinePane, OutlineView } from '@monbolc/lowcode-plugin-outline-pane';
import { BuiltinSimulatorHost, Project, Simulator } from '@monbolc/lowcode-designer';

import { SettingsPanel } from './settings-panel';
import { Overlays } from './overlays';
import { ComponentPalette } from './component-palette';

/** Built-in left views. The host can pass a `leftView` prop to
 *  control which one is active; the default `leftArea` icon strip
 *  exposes a button per built-in view. */
export type LeftView = 'outline' | 'components';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface SkeletonProps {
  /** The editing session. The skeleton drives selection/drag from this. */
  project: Project;
  /** Component registry used by the simulator. */
  components: Record<string, unknown>;
  /** Initial width of left / right panes in percent. */
  leftSize?: number;
  rightSize?: number;
  /**
   * Called once the skeleton's internal OutlinePane is constructed.
   * Consumers (demos, host apps) can use this to drive pane-level
   * actions like `pane.rename(id, newTitle)` from outside the React
   * tree. The pane is reused across schema changes; treat the
   * reference as stable.
   */
  onPaneReady?: (pane: import('@monbolc/lowcode-plugin-outline-pane').OutlinePane) => void;
  /**
   * Per-(componentName, propName) override of which setter to use.
   * Format: `{ [componentName]: { [propName]: setterName } }`.
   * The named setter is looked up via the runtime
   * `@monbolc/lowcode-plugin-setters` registry — i.e. any setter the
   * host registered via `registerSetter(name, comp)` is fair game.
   * See `examples/demo/src/main.ts` for a working example.
   */
  setterConfig?: Record<string, Record<string, string>>;
  /**
   * Content for the **top area** (a thin toolbar row that spans the
   * full editor width above the 3-pane layout). Mirrors ali's
   * `topArea` / `subTopArea` pattern. The host renders whatever
   * toolbar buttons / dropdowns it wants here. Falsy → empty row.
   */
  topArea?: () => React.ReactNode;
  /**
   * Content for the **left area** (a thin icon strip to the LEFT of
   * the existing outline panel). Mirrors ali's `leftArea` / `leftFixedArea`
   * pattern. The host renders icon buttons here (e.g. "switch to
   * Outline" / "switch to Components"). Falsy → render a default
   * icon strip with one button per built-in `LeftView`.
   */
  leftArea?: () => React.ReactNode;
  /**
   * Which left view is currently active. When set, the Skeleton's
   * default leftArea icon strip uses this as the active tab. Updates
   * flow through `onLeftViewChange` so the host can mirror the state
   * in its own UI (e.g. close + reopen the editor to the same view).
   */
  leftView?: LeftView;
  onLeftViewChange?: (view: LeftView) => void;
}

/**
 * Layout classnames (Tailwind v4 utilities; no hand-rolled CSS).
 * Kept here as constants so the JSX stays compact and the
 * Tailwind purger has stable strings to scan.
 */
const CN = {
  // Root PanelGroup: h-full, w-full, system font, small base size.
  skel: 'h-full w-full font-[system-ui,sans-serif] text-xs',
  // Each pane column: flex column, no overflow, 1px slate border on
  // the right (or the left for the last one).
  pane: 'flex flex-col overflow-hidden border-r border-slate-200 h-full [&:last-child]:border-r-0 [&:last-child]:border-l',
  // Pane header: 8/12 padding, semibold, slate-50 bg, bottom border.
  paneHeader: 'px-3 py-2 font-semibold bg-slate-50 border-b border-slate-200',
  // Pane body: fills the rest of the column, scrolls, 8px padding.
  paneBody: 'flex-1 overflow-auto p-2',
  // Canvas (center pane): fills, slate-50 bg, 16px padding, scrolls.
  canvas: 'flex-1 bg-slate-50 p-4 overflow-auto h-full',
  // Canvas inner: white card with border, full height minimum.
  // `relative` is load-bearing: Overlays append absolutely-positioned
  // children to this div. Without it they escape to the next
  // positioned ancestor (often <body>), making selection borders
  // visually misaligned with the element they outline.
  canvasInner: 'relative bg-white min-h-full p-4 border border-slate-200',
  // Empty-state hint (used by SettingsPanel).
  empty: 'text-slate-400 italic p-6 text-center',
  // Resize handle: 4px wide slate bar, hover + active states.
  resize: 'w-1 bg-slate-200 cursor-col-resize hover:bg-slate-400 data-[resize-handle-active]:bg-blue-500',
  // Top area: a thin toolbar row that sits above the canvas INSIDE
  // the center pane (mirrors ali's `subTopArea` exactly). Falsy
  // content → empty div (still reserves 0–28px so the layout stays
  // predictable). NOT absolute / NOT floating — the canvas shrinks
  // to make room, just like ali does.
  topArea: 'flex items-center gap-1 px-2 py-1 bg-white border-b border-slate-200 min-h-[28px]',
  // Left area: thin icon strip to the LEFT of the outline panel.
  // Mirrors ali's `leftArea` (icon column). Slate-50 background,
  // 1px right border, fixed width (40px), flex column.
  leftArea: 'flex flex-col items-center gap-1 py-2 bg-slate-50 border-r border-slate-200 w-10 shrink-0',
} as const;

export function Skeleton(props: SkeletonProps) {
  const leftSize = props.leftSize ?? 20;
  const rightSize = props.rightSize ?? 25;

  // Mirror the project's schema into a local OutlinePane so the tree
  // can render without coupling to the DocumentModel directly.
  const [pane] = useState(() => new OutlinePane());
  const [, force] = useState(0);
  const canvasHost = useRef<HTMLDivElement | null>(null);

  // Which built-in view is shown in the left pane. Mirrors ali's
  // pattern: a thin icon strip on the FAR left picks the view, the
  // panel to the right of it renders the picked view. Local state
  // means the icon strip can survive across re-renders; `leftView`/
  // `onLeftViewChange` are the controlled version the host can use
  // to mirror the choice in its own UI.
  const [leftView, setLeftView] = useState<LeftView>(props.leftView ?? 'outline');
  // Keep local state in sync if the host flips the prop.
  useEffect(() => {
    if (props.leftView && props.leftView !== leftView) setLeftView(props.leftView);
  }, [props.leftView]); // eslint-disable-line react-hooks/exhaustive-deps
  const pickView = (v: LeftView): void => {
    setLeftView(v);
    props.onLeftViewChange?.(v);
  };

  // The canvas host element is stored as BOTH a ref (for the
  // simulator-mount effect that reads it during commit) and state
  // (for BuiltinSimulatorHost and Overlays, which need the live
  // element to re-attach listeners / re-measure on remount). The ref
  // callback updates both.
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const setCanvasRef = (el: HTMLDivElement | null): void => {
    canvasHost.current = el;
    setCanvasEl(el);
  };

  // Notify the host once the pane is constructed. The host may want
  // to call pane-level actions (rename, expand, etc.) from outside
  // the React tree (e.g. a demo toolbar). We use a ref-stable callback
  // so re-renders don't re-fire the notification.
  const onPaneReady = props.onPaneReady;
  useEffect(() => {
    if (onPaneReady) onPaneReady(pane);
    // Intentional: fire once on mount, not on every re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    pane.setSchema(props.project.document.root);
    force((n) => n + 1);
    const onChange = () => {
      pane.setSchema(props.project.document.root);
      force((n) => n + 1);
    };
    props.project.document.events.on('rootChanged', onChange);
    props.project.document.events.on('nodeAdded', onChange);
    props.project.document.events.on('nodeRemoved', onChange);
    props.project.document.events.on('nodeMoved', onChange);
    props.project.document.events.on('nodeRenamed', onChange);
    props.project.document.events.on('nodePropsChanged', onChange);
    return () => {
      props.project.document.events.off('rootChanged', onChange);
      props.project.document.events.off('nodeAdded', onChange);
      props.project.document.events.off('nodeRemoved', onChange);
      props.project.document.events.off('nodeMoved', onChange);
      props.project.document.events.off('nodeRenamed', onChange);
      props.project.document.events.off('nodePropsChanged', onChange);
    };
  }, [pane, props.project]);

  // Mount the simulator into the canvas host div.
  useEffect(() => {
    if (!canvasHost.current) return;
    const sim = new Simulator(props.project.document.root, { components: props.components });
    const el = sim.render();
    canvasHost.current.innerHTML = '';
    const inner = document.createElement('div');
    canvasHost.current.appendChild(inner);
    const root: Root = createRoot(inner);
    root.render(el as Parameters<typeof root.render>[0]);
    return () => {
      // Defer the unmount to a microtask so it doesn't fire
      // synchronously during another component's commit phase.
      // React 19: "Attempted to synchronously unmount a root while
      // React was already rendering" otherwise fires when the user
      // mutates the schema (Add Footer etc.) and the simulator root
      // gets torn down in the middle of a re-render cycle.
      queueMicrotask(() => root.unmount());
    };
  }, [props.project.document.root, props.components]);

  // Wire BuiltinSimulatorHost to the canvas DOM once the canvas
  // element is mounted. The host is the bridge between pointer
  // events and the Dragon: it computes the drop target on each
  // pointermove and commits the move/boost on pointerup. We
  // depend on `canvasEl` (not the ref) so the effect re-fires
  // only when React actually attaches a fresh DOM node.
  useEffect(() => {
    if (!canvasEl) return;
    const host = new BuiltinSimulatorHost(props.project, { canvas: canvasEl });
    host.mount();
    return () => host.unmount();
  }, [canvasEl, props.project]);

  const onOutlineSelect = (id: string) => {
    props.project.select(id);
  };

  // Default left-area icon strip. Two stacked buttons, one per
  // built-in `LeftView`. The active view gets a tinted background so
  // the user can tell at a glance which panel is showing. Hosts that
  // want to drive the left area themselves (e.g. add extra icons)
  // pass their own `leftArea` prop and bypass this default.
  //
  // Labels are 3-letter abbreviations rather than emoji so they
  // render identically across fonts/OSes without pulling in an
  // emoji glyph fallback. Title attributes (the tooltip) carry
  // the full word for accessibility.
  const renderDefaultLeftArea = (): unknown => {
    const btn = (v: LeftView, label: string, title: string): unknown =>
      h()('button', {
        key: v,
        onClick: () => pickView(v),
        title,
        'data-active': leftView === v ? 'true' : 'false',
        className:
          'w-7 h-7 flex items-center justify-center rounded text-[10px] font-mono ' +
          (leftView === v
            ? 'bg-blue-100 text-blue-700 ring-1 ring-blue-300'
            : 'text-slate-600 hover:bg-slate-100'),
      }, label);
    return h()('div', { className: 'flex flex-col items-center gap-1' },
      btn('outline', 'Out', 'Outline view'),
      btn('components', 'Cmp', 'Component palette'),
    );
  };

  // The left Panel's header label and body follow `leftView`. Header
  // text gives the user a textual confirmation of which view is
  // active; body swaps between the outline tree and the drag-source
  // component palette.
  const leftHeader = leftView === 'outline' ? 'Outline' : 'Components';
  const leftBody =
    leftView === 'outline'
      ? h()(OutlineView, { pane, onRowClick: (id: string) => onOutlineSelect(id) })
      : h()(ComponentPalette, { project: props.project, components: props.components });

  return h()('div', { className: CN.skel },
    h()(PanelGroup, { direction: 'horizontal', autoSaveId: 'sapu-skel', className: CN.skel },
      // Left area: thin icon strip OUTSIDE the resizable panels so it
      // stays at a fixed width and never collides with the outline.
      h()('div', { key: 'la', className: CN.leftArea },
        props.leftArea ? props.leftArea() : renderDefaultLeftArea(),
      ),
      h()(Panel, { key: 'left', defaultSize: leftSize, minSize: 15 },
        h()('div', { className: CN.pane },
          h()('div', { className: CN.paneHeader }, leftHeader),
          h()('div', { className: CN.paneBody }, leftBody),
        ),
      ),
      h()(PanelResizeHandle, { key: 'rh-left', className: CN.resize }),
      h()(Panel, { key: 'center', defaultSize: 100 - leftSize - rightSize, minSize: 30 },
        h()('div', { className: 'flex flex-col h-full' },
          // Top area: a row above the canvas, in normal flow. Mirrors
          // ali's `subTopArea` — NOT a floating overlay, NOT a
          // full-width strip. Just a sub-toolbar the host can fill
          // with whatever. Falsy content → empty div with 0 height
          // (the conditional collapses the div entirely so the
          // canvas is unaffected).
          props.topArea
            ? h()('div', { key: 'top', className: CN.topArea }, props.topArea())
            : null,
          h()('div', { className: CN.canvas + ' flex-1' },
            h()('div', { className: CN.canvasInner, ref: setCanvasRef },
              h()(Overlays, { project: props.project, canvasContainer: canvasEl }),
            ),
          ),
        ),
      ),
      h()(PanelResizeHandle, { key: 'rh-right', className: CN.resize }),
      h()(Panel, { key: 'right', defaultSize: rightSize, minSize: 15 },
        h()('div', { className: CN.pane },
          h()('div', { className: CN.paneHeader }, 'Settings'),
          h()('div', { className: CN.paneBody },
            h()(SettingsPanel, { project: props.project, setterConfig: props.setterConfig }),
          ),
        ),
      ),
    ),
  );
}
