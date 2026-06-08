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
 * Outline view — a flat bulleted list: a small filled dot on the
 * left, a short horizontal stroke as the "title bar". Reads as
 * "a list of rows" rather than "a tree of nested boxes", which
 * is the more common shape of an editor outline pane.
 *
 * 5 short rows, dot + line per row, lines of varying length so
 * the glyph doesn't look like a checkbox column.
 */
export function OutlineIcon({ size = 14 }: { size?: number }): unknown {
  // (dotX, dotY, lineEndX) — the y is the row's vertical centre,
  // the line is a 1.4px stroke from dotX+1 to lineEndX.
  const rows: Array<{ y: number; end: number }> = [
    { y: 2,   end: 12.5 },
    { y: 4.5, end: 9    },
    { y: 7,   end: 12   },
    { y: 9.5, end: 7.5  },
    { y: 12,  end: 10.5 },
  ];
  return h()(
    'svg',
    baseSvgProps(size),
    ...rows.flatMap((r) => [
      h()('circle', { cx: 2, cy: r.y, r: 0.7, fill: 'currentColor', stroke: 'none' }),
      h()('path', { d: `M3.2 ${r.y} L${r.end} ${r.y}` }),
    ]),
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
