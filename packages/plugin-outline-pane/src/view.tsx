/**
 * @monbolc/lowcode-plugin-outline-pane — OutlineView
 *
 * React-based tree component built on react-arborist. Reads the
 * `OutlinePane` API as its single source of truth. Uses the runtime
 * injected via the renderer-core adapter (so the source file is
 * technically framework-agnostic, even though it returns JSX).
 */

import { useEffect, useState } from 'react';
import { Tree } from 'react-arborist';

import { adapter } from '@monbolc/lowcode-renderer-core';
import { Emitter } from '@monbolc/lowcode-utils';

import type { ITreeNode } from './tree';
import type { IOutlinePane } from './api';

const h = adapter.getRuntime().createElement;

export interface OutlineViewProps {
  pane: IOutlinePane;
  /** Height in px (react-arborist requires an explicit height). */
  height: number;
  /** Width in px. Optional — defaults to 100% of parent. */
  width?: number;
  /** Custom row renderer. Receives a node and selection helpers. */
  renderRow?: (node: ITreeNode, helpers: RowHelpers) => unknown;
  /** Called when a row is clicked. */
  onRowClick?: (id: string, evt: { meta: boolean; shift: boolean }) => void;
}

export interface RowHelpers {
  isSelected: boolean;
  isExpanded: boolean;
  toggle: () => void;
  select: (modifiers: { meta: boolean; shift: boolean }) => void;
}

/** Re-export the pane event types for downstream consumers. */
export type { OutlinePaneEvents } from './api';

/**
 * Subscribe to a pane event and re-render when it fires.
 * Lightweight replacement for mobx / react-redux — the view is
 * read-only on top of `pane.nodes`, so a single forced re-render
 * on any mutation is sufficient.
 */
function usePaneRevision(pane: IOutlinePane): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const bump = () => setRev((n) => n + 1);
    pane.events.on('schemaChanged', bump);
    pane.events.on('selectionChanged', bump);
    pane.events.on('expansionChanged', bump);
    pane.events.on('renamed', bump);
    return () => {
      pane.events.off('schemaChanged', bump);
      pane.events.off('selectionChanged', bump);
      pane.events.off('expansionChanged', bump);
      pane.events.off('renamed', bump);
    };
  }, [pane]);
  return rev;
}

const defaultRenderRow = (node: ITreeNode, helpers: RowHelpers) => {
  const indent = node.depth * 16;
  const arrow = node.canHaveChildren
    ? h('span', {
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          helpers.toggle();
        },
        style: {
          display: 'inline-block',
          width: 12,
          cursor: 'pointer',
          userSelect: 'none',
          transform: helpers.isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
          transition: 'transform 120ms',
        },
      }, '▶')
    : h('span', { style: { display: 'inline-block', width: 12 } }, '');
  return h('div', {
    onClick: (e: { metaKey: boolean; shiftKey: boolean; stopPropagation: () => void }) => {
      e.stopPropagation();
      helpers.select({ meta: e.metaKey, shift: e.shiftKey });
    },
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      padding: '2px 6px',
      paddingLeft: 6 + indent,
      background: helpers.isSelected ? '#dbeafe' : 'transparent',
      cursor: 'pointer',
      fontSize: 12,
      fontFamily: 'system-ui, sans-serif',
    },
  }, [
    arrow,
    h('span', { style: { color: '#475569' } }, node.title),
    h('span', {
      style: {
        marginLeft: 'auto',
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: 'monospace',
      },
    }, `<${node.componentName}>`),
  ]);
};

export function OutlineView(props: OutlineViewProps) {
  usePaneRevision(props.pane);

  const data = props.pane.nodes;

  if (data.length === 0) {
    return h('div', {
      style: {
        padding: 16,
        color: '#94a3b8',
        fontSize: 12,
        textAlign: 'center',
      },
    }, 'No schema loaded');
  }

  return h(Tree, {
    data,
    idAccessor: (n: ITreeNode) => n.id,
    openByDefault: false,
    width: props.width ?? 280,
    height: props.height,
    indent: 16,
    rowHeight: 24,
    rowProps: ({ node }: { node: { data: ITreeNode } }) => ({
      node: node.data,
      pane: props.pane,
      renderRow: props.renderRow ?? defaultRenderRow,
      onRowClick: props.onRowClick,
    }),
  }, ({ node, ...rest }: { node: { data: ITreeNode }; [k: string]: unknown }) => {
    const rowNode: ITreeNode = node.data;
    const extras = rest as { pane: IOutlinePane; renderRow: typeof defaultRenderRow };
    const pane: IOutlinePane = extras.pane;
    const renderRow = extras.renderRow;
    const helpers: RowHelpers = {
      isSelected: pane.isSelected(rowNode.id),
      isExpanded: pane.isExpanded(rowNode.id),
      toggle: () => pane.toggle(rowNode.id),
      select: (modifiers) => {
        if (modifiers.shift && pane.selectedIds.length > 0) {
          // multi-select: select everything between last and current
          const last = pane.selectedIds[pane.selectedIds.length - 1];
          const ids = pane.nodes;
          const i1 = ids.findIndex((n) => n.id === last);
          const i2 = ids.findIndex((n) => n.id === rowNode.id);
          if (i1 >= 0 && i2 >= 0) {
            const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
            pane.select(ids.slice(lo, hi + 1).map((n) => n.id));
            return;
          }
        }
        pane.select([rowNode.id]);
      },
    };
    return renderRow(rowNode, helpers);
  });
}

/** Re-export for testing / external use. */
export { Emitter };
