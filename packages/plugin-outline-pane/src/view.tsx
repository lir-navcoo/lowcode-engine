/**
 * @monbolc/lowcode-plugin-outline-pane — OutlineView
 *
 * React-based tree component built on react-arborist. Reads the
 * `OutlinePane` API as its single source of truth. Uses the runtime
 * injected via the renderer-core adapter (so the source file is
 * technically framework-agnostic, even though it returns JSX).
 */

import { useEffect, useRef, useState } from 'react';
import { Tree } from 'react-arborist';

import { adapter } from '@monbolc/lowcode-renderer-core';
import { Emitter } from '@monbolc/lowcode-utils';

import type { ITreeNode } from './tree';
import type { IOutlinePane } from './api';

/**
 * Resolver for the framework's `createElement`. Read fresh on every
 * render so consumers can install the runtime AFTER the module has
 * already been loaded (important for testing).
 */
const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface OutlineViewProps {
  pane: IOutlinePane;
  /**
   * Height in px (react-arborist requires an explicit height).
   * Optional — when omitted, the view auto-sizes to its parent
   * via a ResizeObserver and reports the measured height to the
   * tree. Tests and fixed-size callers can still pass a number.
   */
  height?: number;
  /**
   * Width in px. Optional — defaults to 100% of parent. The value
   * is forwarded to react-arborist, which accepts `number | string`
   * in 3.9.x and uses it as the tree container's CSS width.
   */
  width?: number | string;
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
  /** True if this row is currently in rename edit mode. */
  isEditing: boolean;
  /** Current draft value while editing. */
  draft: string;
  /** Enter rename mode (no-op if already editing). */
  startRename: () => void;
  /** Commit the current draft as the new display title. */
  commitRename: (newTitle: string) => void;
  /** Cancel rename mode without committing. */
  cancelRename: () => void;
  /**
   * True for non-root rows that should expose the rename UI. Ali's
   * reference: `shouldEditBtn = isCNode && isNodeParent`
   * (tree-title.tsx:146). We match that — the root has no rename
   * button and is not double-clickable to rename.
   */
  canRename: boolean;
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
    ? h()('span', {
        key: 'arrow',
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
    : h()('span', { key: 'arrow', style: { display: 'inline-block', width: 12 } }, '');

  // Title cell: either a span (view mode) or an input (edit mode,
  // Enter/blur → commit, Escape → cancel). The ✎ button on the
  // right is the only rename entry point — neither single-click
  // nor dblclick on the title itself triggers rename.
  //
  // Why no click-to-rename: clicking the title in a tree should
  // navigate (select) the node, not mutate it. Rename is an
  // explicit, opt-in operation; the ✎ button is a small,
  // discoverable affordance that doesn't compete with selection.
  // Ali's reference (tree-title.tsx:146) gates the rename UI on
  // `isCNode && isNodeParent`; we match that with `canRename =
  // rowNode.parentId !== ''` (root is excluded). dblclick was
  // tried first but in real browsers React 19 + react-arborist
  // event delegation occasionally swallowed the second click of a
  // dblclick, leaving the user in "I clicked but nothing
  // happened" land. ✎ is the supported path.
  //
  // When the input mounts we autoFocus + select() so the user
  // can type to replace. The callback ref pattern works with the
  // hyperscript descriptor without needing forwardRef.
  //
  // The input holds its own DOM value while the user types — we
  // don't push every keystroke back into OutlineView's React state
  // (no point; we only need the value on commit). On Enter or blur
  // we read the live value from the event target and pass it to
  // commitRename().
  const titleCell = helpers.isEditing
    ? h()('input', {
        key: 'title-input',
        ref: (el: HTMLInputElement | null) => {
          if (el) {
            el.focus();
            el.select();
          }
        },
        defaultValue: helpers.draft,
        onBlur: (e: { target: HTMLInputElement }) =>
          helpers.commitRename(e.target.value),
        onKeyDown: (e: { key: string; target: HTMLInputElement }) => {
          if (e.key === 'Enter') {
            helpers.commitRename(e.target.value);
          } else if (e.key === 'Escape') {
            helpers.cancelRename();
          }
        },
        onClick: (e: { stopPropagation: () => void }) => e.stopPropagation(),
        style: {
          flex: 1,
          fontSize: 12,
          fontFamily: 'system-ui, sans-serif',
          padding: '1px 4px',
          border: '1px solid #3b82f6',
          borderRadius: 2,
          background: 'white',
          color: '#0f172a',
        },
      })
    : h()('span', {
        key: 'title',
        style: {
          flex: 1,
          color: '#475569',
        },
      }, node.title);

  // Pencil button — visible for any renamable row. Ali hides it
  // until hover; we keep it always visible for discoverability in
  // a headless component test environment where there is no hover.
  const renameBtn = helpers.canRename
    ? h()('span', {
        key: 'rename',
        onClick: (e: { stopPropagation: () => void }) => {
          e.stopPropagation();
          helpers.startRename();
        },
        title: 'Rename label (display title only — does not change component type)',
        style: {
          fontSize: 11,
          color: '#94a3b8',
          cursor: 'pointer',
          padding: '0 2px',
          userSelect: 'none',
        },
      }, '✎')
    : h()('span', { key: 'rename', style: { width: 0 } }, '');

  return h()('div', {
    onClick: (e: { metaKey: boolean; shiftKey: boolean; stopPropagation: () => void }) => {
      // Don't clobber the selection when the user clicks inside the
      // rename input (the input's own onClick stops propagation, so
      // this only fires for the row's surrounding div).
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
    titleCell,
    renameBtn,
    h()('span', {
      key: 'componentName',
      style: {
        fontSize: 10,
        color: '#94a3b8',
        fontFamily: 'monospace',
      },
    }, `<${node.componentName}>`),
  ]);
};

/**
 * Observe an element's content-box height and return it as a number.
 *
 * react-arborist's `Tree` requires `height: number` (used in row
 * positioning math), but typical skeleton layouts don't want a fixed
 * height — they want the tree to fill the pane body. This hook lets
 * the view auto-size by watching the parent with a ResizeObserver.
 *
 * The hook accepts a forced height for tests / fixed callers and
 * short-circuits the observer in that case.
 */
function useContainerHeight(forced?: number): {
  hostRef: React.RefObject<HTMLDivElement | null>;
  height: number;
} {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [height, setHeight] = useState<number>(forced ?? 0);

  useEffect(() => {
    if (forced !== undefined) {
      setHeight(forced);
      return;
    }
    const el = hostRef.current;
    if (!el) return;
    // Initial measurement (the element may have a layout already).
    setHeight(el.clientHeight);
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const next = entry.contentRect.height;
      // Skip the no-op update to avoid an infinite render loop in
      // case ResizeObserver fires with the same value.
      setHeight((prev) => (prev === next ? prev : next));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [forced]);

  return { hostRef, height };
}

export function OutlineView(props: OutlineViewProps) {
  usePaneRevision(props.pane);

  const data = props.pane.nodes;
  const renderRow = props.renderRow ?? defaultRenderRow;
  const onRowClick = props.onRowClick;
  // Capture pane + renderRow in a closure so the row children function
  // can use them. (react-arborist does not forward rowProps to the
  // children function, so we need this approach.)
  const paneRef = props.pane;

  // Fill the parent: width defaults to '100%' (string is accepted by
  // react-arborist 3.9.x), height is observed from the host div.
  const width: number | string = props.width ?? '100%';
  const { hostRef, height } = useContainerHeight(props.height);

  // Per-row rename state. Only one row is in edit mode at a time.
  // The "draft" is the initial value seeded when edit mode starts;
  // we don't track per-keystroke draft updates (the input holds its
  // own DOM value; Enter/blur reads it back).
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');

  const container = (child: unknown) =>
    h()('div', {
      ref: hostRef,
      style: { width: '100%', height: '100%' },
    }, child);

  if (data.length === 0) {
    return container(h()('div', {
      style: {
        padding: 16,
        color: '#94a3b8',
        fontSize: 12,
        textAlign: 'center',
      },
    }, 'No schema loaded'));
  }

  return container(h()(Tree, {
    data,
    idAccessor: (n: ITreeNode) => n.id,
    openByDefault: false,
    width,
    height,
    indent: 16,
    rowHeight: 24,
  }, ({ node }: { node: { data: ITreeNode } }) => {
    const rowNode: ITreeNode = node.data;
    const pane: IOutlinePane = paneRef;
    // Root has no parent → depth 0 + parentId '' → not renamable,
    // matching ali's `isCNode` guard (tree-title.tsx:146).
    const canRename = rowNode.parentId !== '';
    const isEditing = editingId === rowNode.id;
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
        if (onRowClick) onRowClick(rowNode.id, { meta: modifiers.meta, shift: modifiers.shift });
      },
      canRename,
      isEditing,
      draft,
      startRename: () => {
        if (!canRename) return;
        setDraft(rowNode.title);
        setEditingId(rowNode.id);
      },
      commitRename: (newTitle: string) => {
        // Only commit if THIS row is currently being edited. (blur can
        // fire on a stale input when the user clicked elsewhere after
        // committing via Enter.)
        if (editingId !== rowNode.id) return;
        const trimmed = newTitle.trim();
        if (trimmed.length > 0) {
          pane.rename(rowNode.id, trimmed);
        }
        setEditingId(null);
        setDraft('');
      },
      cancelRename: () => {
        if (editingId !== rowNode.id) return;
        setEditingId(null);
        setDraft('');
      },
    };
    return renderRow(rowNode, helpers);
  }));
}

/** Re-export for testing / external use. */
export { Emitter };
/** Re-export the default row renderer for unit tests. The full Tree
 *  path needs measurements (react-arborist) that happy-dom doesn't
 *  provide, so we test defaultRenderRow in isolation. */
export { defaultRenderRow };
