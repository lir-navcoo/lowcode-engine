/**
 * @monbolc/lowcode-designer — components/Title
 * Ali-mirror Phase D.I6 shim: the `Title` widget.
 *
 * Ali-faithful: `<Title title={...} className="..." />` renders a small
 * `<div class="lc-borders-title">{label}</div>` next to a border. Used
 * in 4 bem-tool files (border-detecting, border-selecting,
 * border-container, border-resizing).
 *
 * Slim port: a 10-LoC React component that handles the common cases
 * (string title, IPublicTypeI18nData shape `{ type, value }`, plain
 * ReactNode). Ali uses an icon + label combo; the slim port uses a
 * `<span title={...}>` for the hover tooltip and a plain `<span>` for
 * the label.
 */
import * as React from 'react';

export interface ITitleProps {
  /** The title text. Accepts a string or a ReactNode (e.g. a JSX element). */
  title: unknown;
  /** Optional className for the outer div. */
  className?: string;
}

/**
 * Slim port of ali's `<Title>`. Ali-faithful surface (single `title` prop
 * + optional `className`); the slim implementation uses a native HTML
 * `title` attribute for the hover tooltip and a plain text span for
 * the label.
 */
export function Title({ title, className }: ITitleProps): React.ReactElement {
  let label: React.ReactNode;
  if (typeof title === 'string') {
    label = title;
  } else if (React.isValidElement(title)) {
    label = title;
  } else if (title && typeof title === 'object' && 'value' in (title as Record<string, unknown>)) {
    // IPublicTypeI18nData shape: { type, value }
    label = String((title as { value?: unknown }).value ?? '');
  } else {
    label = String(title ?? '');
  }
  return (
    <div className={className} title={typeof label === 'string' ? label : undefined}>
      {label}
    </div>
  );
}
