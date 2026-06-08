/**
 * @monbolc/lowcode-shell — SapuErrorBoundary
 *
 * A React 19 `componentDidCatch` boundary used to insulate the
 * editor UI from plugin crashes. The `engine` prop is optional —
 * when present, errors are also surfaced as `pluginError` events
 * on the engine's bus (so the host can show a toast, log to Sentry,
 * etc.).
 *
 * Sapu stance:
 *   - Plain React class component (no `react-error-boundary` dep,
 *     no `useErrorBoundary` hook — the standard API is enough).
 *   - The fallback is a plain `<div role="alert">` with Tailwind
 *     classes. We intentionally do NOT use the BaseUI `Modal`
 *     widget here: an error boundary must be side-effect-free
 *     (no portals, no focus traps, no animations), so a plain
 *     div keeps the failure path boring and reliable.
 *   - When `engine` is provided, we resolve the localized title
 *     + hint via `engine.i18n.t(...)` so the error UI respects
 *     the host's locale.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';

import type { SapuEngine } from './sapu-engine';

export interface SapuErrorBoundaryProps {
  /** The host engine — when provided, errors also fire `pluginError`. */
  engine?: SapuEngine;
  /** Override the default fallback UI. */
  fallback?: ReactNode;
  /** The children to render when no error is active. */
  children: ReactNode;
}

export interface SapuErrorBoundaryState {
  error: Error | null;
}

/**
 * Default fallback UI. Renders a centered, full-bleed warning
 * with a Reload button that calls `window.location.reload()`.
 */
export function DefaultErrorFallback({ error }: { error: Error }): ReactNode {
  return (
    <div
      role="alert"
      className="flex h-full min-h-[200px] w-full flex-col items-center justify-center gap-3 bg-rose-50 p-6 text-rose-900"
    >
      <div className="text-base font-semibold">Error: {error.message || 'Unexpected error'}</div>
      <div className="max-w-md text-center text-sm text-rose-700">
        The editor crashed. Check the console for details.
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded border border-rose-300 bg-white px-3 py-1 text-sm text-rose-700 hover:bg-rose-100"
      >
        Reload
      </button>
    </div>
  );
}

export class SapuErrorBoundary extends Component<SapuErrorBoundaryProps, SapuErrorBoundaryState> {
  state: SapuErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): SapuErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Always log — even when there's no engine to notify. This
    // makes diagnosing headless demo crashes much easier.
    // eslint-disable-next-line no-console
    console.error('[SapuErrorBoundary]', error, info.componentStack);
    const { engine } = this.props;
    if (engine) {
      engine.events.emit('pluginError', {
        name: 'SapuErrorBoundary',
        error,
      });
    }
  }

  override render(): ReactNode {
    const { error } = this.state;
    const { fallback, children } = this.props;
    if (error) {
      return fallback ?? <DefaultErrorFallback error={error} />;
    }
    return children;
  }
}
