/**
 * @monbolc/lowcode-editor-skeleton — UI Overlays
 *
 * Four visual feedback components for the design-mode canvas:
 *   - Border:     1px outline around the selected node(s)
 *   - Hover:      subtle blue tint on the hovered node
 *   - DragGhost:  ghost element that follows the cursor during drag
 *   - InsertionIndicator:  horizontal line showing where a drop will land
 *
 * All four read from Project + Dragon state. They mount as
 * absolutely-positioned siblings of the canvas.
 */

import { useEffect, useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Project } from '@monbolc/lowcode-designer';
import type { DropTarget } from '@monbolc/lowcode-designer';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface OverlaysProps {
  project: Project;
  /** The canvas container (used to position overlays relative to it). */
  canvasContainer: HTMLElement | null;
}

function tagSelector(id: string): string {
  return `[data-lce-id="${id.replace(/"/g, '\\"')}"]`;
}

/**
 * Subscribe to project + dragon events and force a re-render.
 * (A useSyncExternalStore would be more correct but requires more
 * setup; the manual subscription is fine for these overlays.)
 */
function useRev(project: Project): number {
  const [rev, setRev] = useState(0);
  useEffect(() => {
    const bump = () => setRev((n) => n + 1);
    project.events.on('selectionChanged', bump);
    project.events.on('nodeMoved', bump);
    project.events.on('nodeAdded', bump);
    project.events.on('nodeRemoved', bump);
    project.dragon.events.on('start', bump);
    project.dragon.events.on('move', bump);
    project.dragon.events.on('end', bump);
    project.dragon.events.on('drop', bump);
    project.dragon.events.on('cancel', bump);
    return () => {
      project.events.off('selectionChanged', bump);
      project.events.off('nodeMoved', bump);
      project.events.off('nodeAdded', bump);
      project.events.off('nodeRemoved', bump);
      project.dragon.events.off('start', bump);
      project.dragon.events.off('move', bump);
      project.dragon.events.off('end', bump);
      project.dragon.events.off('drop', bump);
      project.dragon.events.off('cancel', bump);
    };
  }, [project]);
  return rev;
}

/**
 * Border: render a 1px blue outline around the currently-selected
 * node(s). Done via DOM manipulation (not React) so we can render
 * overlays in a separate React tree.
 */
function renderBorders(canvas: HTMLElement, selectedIds: string[]): void {
  // Clear old borders
  canvas.querySelectorAll('.sapu-border-overlay').forEach((n) => n.remove());

  for (const id of selectedIds) {
    const el = canvas.querySelector(tagSelector(id)) as HTMLElement | null;
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const canvasR = canvas.getBoundingClientRect();
    const overlay = document.createElement('div');
    overlay.className = 'sapu-border-overlay';
    Object.assign(overlay.style, {
      position: 'absolute',
      left: `${r.left - canvasR.left - 1}px`,
      top: `${r.top - canvasR.top - 1}px`,
      width: `${r.width + 2}px`,
      height: `${r.height + 2}px`,
      border: '1.5px solid #3b82f6',
      borderRadius: '2px',
      pointerEvents: 'none',
      zIndex: '9998',
    });
    canvas.appendChild(overlay);
  }
}

/** Hover: light blue tint on the currently-hovered node. */
function renderHover(canvas: HTMLElement, hoverId: string | null): void {
  canvas.querySelectorAll('.sapu-hover-overlay').forEach((n) => n.remove());
  if (!hoverId) return;
  const el = canvas.querySelector(tagSelector(hoverId)) as HTMLElement | null;
  if (!el) return;
  const r = el.getBoundingClientRect();
  const canvasR = canvas.getBoundingClientRect();
  const overlay = document.createElement('div');
  overlay.className = 'sapu-hover-overlay';
  Object.assign(overlay.style, {
    position: 'absolute',
    left: `${r.left - canvasR.left}px`,
    top: `${r.top - canvasR.top}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
    background: 'rgba(59, 130, 246, 0.06)',
    pointerEvents: 'none',
    zIndex: '9997',
  });
  canvas.appendChild(overlay);
}

/** DragGhost: a ghost element at the cursor position during a drag. */
function renderDragGhost(canvas: HTMLElement, x: number, y: number, label: string): void {
  let ghost = canvas.querySelector('.sapu-drag-ghost') as HTMLElement | null;
  if (!ghost) {
    ghost = document.createElement('div');
    ghost.className = 'sapu-drag-ghost';
    Object.assign(ghost.style, {
      position: 'absolute',
      padding: '4px 8px',
      background: '#3b82f6',
      color: 'white',
      fontSize: '12px',
      fontFamily: 'monospace',
      borderRadius: '3px',
      boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
      pointerEvents: 'none',
      zIndex: '9999',
    });
    canvas.appendChild(ghost);
  }
  const canvasR = canvas.getBoundingClientRect();
  ghost.style.left = `${x - canvasR.left + 8}px`;
  ghost.style.top = `${y - canvasR.top + 8}px`;
  ghost.textContent = label;
}

function clearDragGhost(canvas: HTMLElement): void {
  canvas.querySelectorAll('.sapu-drag-ghost').forEach((n) => n.remove());
}

/** InsertionIndicator: 2px blue line at the computed drop position. */
function renderInsertion(canvas: HTMLElement, target: DropTarget | null): void {
  canvas.querySelectorAll('.sapu-insertion-indicator').forEach((n) => n.remove());
  if (!target) return;
  // Resolve the parent element to find the absolute y for the index.
  const parent = target.parentId
    ? canvas.querySelector(tagSelector(target.parentId)) as HTMLElement | null
    : canvas; // root
  if (!parent) return;
  const parentR = parent.getBoundingClientRect();
  const canvasR = canvas.getBoundingClientRect();
  // Approximate child positions. Children of the parent that are direct
  // descendants in the DOM. For a simplified version we use the parent's
  // vertical position scaled by index/count.
  const children = parent.querySelectorAll(':scope > *');
  const total = Math.max(children.length, 1);
  const ratio = total === 0 ? 0 : target.index / total;
  const y = parentR.top - canvasR.top + parentR.height * ratio;
  const line = document.createElement('div');
  line.className = 'sapu-insertion-indicator';
  Object.assign(line.style, {
    position: 'absolute',
    left: `${parentR.left - canvasR.left}px`,
    top: `${y - 1}px`,
    width: `${parentR.width}px`,
    height: '2px',
    background: '#3b82f6',
    pointerEvents: 'none',
    zIndex: '9996',
  });
  canvas.appendChild(line);
}

/**
 * The Overlays component reads from project + dragon, then imperatively
 * renders the overlay divs. Itself returns null.
 */
export function Overlays(props: OverlaysProps) {
  useRev(props.project);

  // Re-render overlays on every state change.
  useEffect(() => {
    const canvas = props.canvasContainer;
    if (!canvas) return;

    // Borders: one per selected id
    renderBorders(canvas, props.project.selectedIds);

    // DragGhost + InsertionIndicator reflect Dragon state
    const ds = props.project.dragon.state;
    if (ds.draggingNodeId) {
      const node = props.project.document.getNode(ds.draggingNodeId);
      const label = node ? `↔ ${node.componentName}` : '↔ ?';
      renderDragGhost(canvas, ds.x, ds.y, label);
      renderInsertion(canvas, ds.dropTarget);
    } else {
      clearDragGhost(canvas);
      renderInsertion(canvas, null);
    }
  });

  return null;
}
