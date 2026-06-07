/**
 * @monbolc/lowcode-editor-skeleton — FloatingPanel (Panel primitive)
 *
 * A draggable, resizable-as-content-grows floating panel. The
 * foundation for plugin widgets (preview, error log, color picker)
 * that don't fit a fixed pane. Sapu's stance: this is the only
 * `Panel` primitive we ship — anything that needs a layout other
 * than "drag around the canvas" can layer on top.
 *
 * - Drag: click + drag the title bar
 * - Resize: not in scope (intentional — ali's DockPanel resize
 *   machinery is ~300 lines and Sapu collapses it to "let the
 *   content size itself"). Hosts that need a hard size can set
 *   `width` / `height` props.
 * - Position: tracked in state. Defaults to the top-right of the
 *   parent container, offset by 16px.
 *
 * Tailwind v4 utilities for styling. No hand-rolled CSS.
 */

import { useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface SapuFloatingPanelProps {
  title: string;
  /** Optional close handler; if omitted, no close button is shown. */
  onClose?: () => void;
  /** Initial position relative to the parent container. */
  initialX?: number;
  initialY?: number;
  /** Hard size (overrides auto-size). */
  width?: number | string;
  height?: number | string;
  children?: React.ReactNode;
}

interface Pos { x: number; y: number; }

/**
 * A draggable floating panel. Renders into the document (not into
 * the React tree's parent) so it floats above everything else.
 * Internally tracks its own drag offset.
 *
 * The drag uses document-level mouse listeners attached on
 * mousedown and removed on mouseup — no React effects needed for
 * the listener lifecycle. setPos triggers a re-render with the
 * new position; React batches that on the mouse-move tick.
 */
export function SapuFloatingPanel(props: SapuFloatingPanelProps) {
  const [pos, setPos] = useState<Pos>({
    x: props.initialX ?? 16,
    y: props.initialY ?? 16,
  });

  const onTitleMouseDown = (e: React.MouseEvent) => {
    // Only respond to primary button.
    if (e.button !== 0) return;
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = pos.x;
    const originY = pos.y;

    const onMove = (ev: MouseEvent) => {
      setPos({ x: originX + (ev.clientX - startX), y: originY + (ev.clientY - startY) });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const widthStyle = props.width !== undefined
    ? (typeof props.width === 'number' ? `${props.width}px` : props.width)
    : undefined;
  const heightStyle = props.height !== undefined
    ? (typeof props.height === 'number' ? `${props.height}px` : props.height)
    : undefined;

  return h()(
    'div',
    {
      className:
        'fixed z-[9995] bg-white rounded-md shadow-lg border border-slate-200 ' +
        'flex flex-col text-xs text-slate-800 min-w-[200px]',
      style: { left: `${pos.x}px`, top: `${pos.y}px`, width: widthStyle, height: heightStyle },
    },
    h()(
      'div',
      {
        className:
          'px-3 py-1.5 bg-slate-50 border-b border-slate-200 rounded-t-md ' +
          'flex items-center gap-2 cursor-move select-none',
        onMouseDown: onTitleMouseDown,
      },
      h()('span', { className: 'flex-1 font-semibold' }, props.title),
      props.onClose
        ? h()(
            'button',
            {
              type: 'button',
              onClick: props.onClose,
              className:
                'text-slate-500 hover:text-slate-900 w-5 h-5 grid place-items-center ' +
                'rounded hover:bg-slate-200',
              'aria-label': 'Close panel',
            },
            '✕',
          )
        : null,
    ),
    h()('div', { className: 'p-3 flex-1 overflow-auto' }, props.children),
  );
}
