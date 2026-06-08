/**
 * @monbolc/lowcode-editor-skeleton — shared icon components
 *
 * Tiny inline SVG icons used by the widget primitives (floating
 * panel, toast, modal). Kept as plain function components so
 * the host can swap in their own icon set later by re-exporting
 * this module with replacements.
 *
 * No external icon library — a 10x10 viewBox is enough for these
 * two glyphs. Stroke is `currentColor` so the icon inherits the
 * surrounding text color.
 */

import { adapter } from '@monbolc/lowcode-renderer-core';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

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
