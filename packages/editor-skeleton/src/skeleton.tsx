/**
 * @monbolc/lowcode-editor-skeleton — Skeleton
 *
 * The 3-pane editor layout, powered by react-resizable-panels:
 *   - Left: outline tree (uses plugin-outline-pane)
 *   - Center: simulator (renders the page)
 *   - Right: settings panel (props editor)
 *
 * Pane widths are user-resizable via drag handles between panels.
 */

import { useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { OutlinePane, OutlineView } from '@monbolc/lowcode-plugin-outline-pane';
import { Project, Simulator } from '@monbolc/lowcode-designer';

import { SettingsPanel } from './settings-panel';

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
}

const STYLES = `
.sapu-skel { height: 100%; width: 100%; font-family: system-ui, sans-serif; font-size: 12px; }
.sapu-skel-pane { display: flex; flex-direction: column; overflow: hidden; border-right: 1px solid #e2e8f0; height: 100%; }
.sapu-skel-pane:last-child { border-right: none; border-left: 1px solid #e2e8f0; }
.sapu-skel-pane-header { padding: 8px 12px; font-weight: 600; background: #f8fafc; border-bottom: 1px solid #e2e8f0; }
.sapu-skel-pane-body { flex: 1; overflow: auto; padding: 8px; }
.sapu-skel-canvas { flex: 1; background: #fafafa; padding: 16px; overflow: auto; height: 100%; }
.sapu-skel-canvas-inner { background: white; min-height: 100%; padding: 16px; border: 1px solid #e2e8f0; }
.sapu-skel-empty { color: #94a3b8; font-style: italic; padding: 24px; text-align: center; }
.sapu-skel-resize { width: 4px; background: #e2e8f0; cursor: col-resize; }
.sapu-skel-resize:hover { background: #94a3b8; }
.sapu-skel-resize[data-resize-handle-active] { background: #3b82f6; }
`;

/**
 * Mount the global stylesheet once. Idempotent.
 */
let _stylesInjected = false;
function injectStyles(): void {
  if (_stylesInjected) return;
  if (typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.textContent = STYLES;
  document.head.appendChild(style);
  _stylesInjected = true;
}

export function Skeleton(props: SkeletonProps) {
  injectStyles();
  const leftSize = props.leftSize ?? 20;
  const rightSize = props.rightSize ?? 25;

  // Mirror the project's schema into a local OutlinePane so the tree
  // can render without coupling to the DocumentModel directly.
  const [pane] = useState(() => new OutlinePane());
  const [, force] = useState(0);
  const canvasHost = useRef<HTMLDivElement | null>(null);

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
    return () => root.unmount();
  }, [props.project.document.root, props.components]);

  const onOutlineSelect = (id: string) => {
    props.project.select(id);
  };

  return h()(PanelGroup, { direction: 'horizontal', autoSaveId: 'sapu-skel' },
    h()(Panel, { defaultSize: leftSize, minSize: 15 },
      h()('div', { className: 'sapu-skel-pane' },
        h()('div', { className: 'sapu-skel-pane-header' }, 'Outline'),
        h()('div', { className: 'sapu-skel-pane-body' },
          h()(OutlineView, { pane, height: 600, onRowClick: (id: string) => onOutlineSelect(id) }),
        ),
      ),
    ),
    h()(PanelResizeHandle, { className: 'sapu-skel-resize' }),
    h()(Panel, { defaultSize: 100 - leftSize - rightSize, minSize: 30 },
      h()('div', { className: 'sapu-skel-canvas' },
        h()('div', { className: 'sapu-skel-canvas-inner', ref: canvasHost }),
      ),
    ),
    h()(PanelResizeHandle, { className: 'sapu-skel-resize' }),
    h()(Panel, { defaultSize: rightSize, minSize: 15 },
      h()('div', { className: 'sapu-skel-pane' },
        h()('div', { className: 'sapu-skel-pane-header' }, 'Settings'),
        h()('div', { className: 'sapu-skel-pane-body' },
          h()(SettingsPanel, { project: props.project }),
        ),
      ),
    ),
  );
}
