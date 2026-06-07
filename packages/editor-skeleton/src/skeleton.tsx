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
import { Project, Simulator } from '@monbolc/lowcode-designer';

import { SettingsPanel } from './settings-panel';
import { Overlays } from './overlays';

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
  canvasInner: 'bg-white min-h-full p-4 border border-slate-200',
  // Empty-state hint (used by SettingsPanel).
  empty: 'text-slate-400 italic p-6 text-center',
  // Resize handle: 4px wide slate bar, hover + active states.
  resize: 'w-1 bg-slate-200 cursor-col-resize hover:bg-slate-400 data-[resize-handle-active]:bg-blue-500',
} as const;

export function Skeleton(props: SkeletonProps) {
  const leftSize = props.leftSize ?? 20;
  const rightSize = props.rightSize ?? 25;

  // Mirror the project's schema into a local OutlinePane so the tree
  // can render without coupling to the DocumentModel directly.
  const [pane] = useState(() => new OutlinePane());
  const [, force] = useState(0);
  const canvasHost = useRef<HTMLDivElement | null>(null);

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

  // canvasHostRef points at the inner canvas div. The Overlays
  // component needs the host element (not the React ref object)
  // so it can read `getBoundingClientRect()` for positioning.
  // We snapshot it into state via the ref callback so children
  // see the current element instead of `null` on first render.
  const [canvasEl, setCanvasEl] = useState<HTMLDivElement | null>(null);
  const setCanvasRef = (el: HTMLDivElement | null) => {
    canvasHost.current = el;
    setCanvasEl(el);
  };

  const onOutlineSelect = (id: string) => {
    props.project.select(id);
  };

  return h()(PanelGroup, { direction: 'horizontal', autoSaveId: 'sapu-skel', className: CN.skel },
    h()(Panel, { key: 'left', defaultSize: leftSize, minSize: 15 },
      h()('div', { className: CN.pane },
        h()('div', { className: CN.paneHeader }, 'Outline'),
        h()('div', { className: CN.paneBody },
          h()(OutlineView, { pane, onRowClick: (id: string) => onOutlineSelect(id) }),
        ),
      ),
    ),
    h()(PanelResizeHandle, { key: 'rh-left', className: CN.resize }),
    h()(Panel, { key: 'center', defaultSize: 100 - leftSize - rightSize, minSize: 30 },
      h()('div', { className: CN.canvas },
        h()('div', { className: CN.canvasInner, ref: setCanvasRef },
          h()(Overlays, { project: props.project, canvasContainer: canvasEl }),
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
  );
}
