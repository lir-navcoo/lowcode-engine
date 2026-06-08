/**
 * @monbolc/lowcode-editor-skeleton — shared icon components
 *
 * Tiny inline SVG icons used by the widget primitives (floating
 * panel, toast, modal) and the default left-area view switcher in
 * the Skeleton. Kept as plain function components so the host can
 * swap in their own icon set later by re-exporting this module with
 * replacements.
 *
 * No external icon library — a 14x14 viewBox is enough for these
 * glyphs. Stroke is `currentColor` so the icon inherits the
 * surrounding text color. `aria-hidden` is set so screen readers
 * skip the SVG; the parent button's `title` attribute carries the
 * accessible name.
 */

import { adapter } from '@monbolc/lowcode-renderer-core';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

const baseSvgProps = (size: number): Record<string, unknown> => ({
  width: size,
  height: size,
  viewBox: '0 0 14 14',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.4,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
});

/** Close / dismiss — two crossed strokes. */
export function CloseIcon({ size = 10 }: { size?: number }): unknown {
  return h()(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 10 10',
      'aria-hidden': 'true',
      focusable: 'false',
    },
    h()('path', {
      d: 'M1 1 L9 9 M9 1 L1 9',
      stroke: 'currentColor',
      strokeWidth: 1.5,
      strokeLinecap: 'round',
      fill: 'none',
    }),
  );
}

/**
 * Outline view — a small tree/hierarchy: one root node with two
 * children. Mirrors the visual idiom of "list/tree" icons in most
 * design tools.
 */
export function OutlineIcon({ size = 14 }: { size?: number }): unknown {
  return h()(
    'svg',
    baseSvgProps(size),
    // root node
    h()('rect', { x: 1.5, y: 2, width: 3.5, height: 2, rx: 0.4 }),
    // child node 1
    h()('rect', { x: 1.5, y: 6.5, width: 3.5, height: 2, rx: 0.4 }),
    // child node 2
    h()('rect', { x: 1.5, y: 11, width: 3.5, height: 2, rx: 0.4 }),
    // vertical connector from root to its children
    h()('path', { d: 'M3.25 4 L3.25 13' }),
  );
}

/**
 * Components palette — a 2x2 grid of squares. The "palette" /
 * "components drawer" idiom used by most editor toolbars.
 */
export function ComponentsIcon({ size = 14 }: { size?: number }): unknown {
  return h()(
    'svg',
    baseSvgProps(size),
    h()('rect', { x: 1.5, y: 1.5, width: 4.5, height: 4.5, rx: 0.6 }),
    h()('rect', { x: 8,   y: 1.5, width: 4.5, height: 4.5, rx: 0.6 }),
    h()('rect', { x: 1.5, y: 8,   width: 4.5, height: 4.5, rx: 0.6 }),
    h()('rect', { x: 8,   y: 8,   width: 4.5, height: 4.5, rx: 0.6 }),
  );
}
