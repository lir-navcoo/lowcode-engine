/**
 * @monbolc/lowcode-editor-skeleton — Toast (PopupService lite)
 *
 * A simple "pop a message, fade out after N seconds" widget. Sapu's
 * stance: Toast is a one-file wrapper, not a service registry —
 * hosts that want a global toast bus can wire a singleton at the
 * app level, but the engine itself doesn't ship one (per upstream
 * PopupService's ~250 lines, this collapses to one component).
 *
 * Implemented as plain divs (not BaseUI's Toast.Provider-required
 * `Toast.Root`) for two reasons: (1) keeps the package zero-config
 * for hosts, and (2) tests stay simple — no Provider wrapping.
 * Tailwind v4 utilities drive the styling.
 */

import { useEffect, useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';

import { CloseIcon } from './icons';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

export interface SapuToastItem {
  /** Unique id. The manager auto-fires `dismiss` on this when the
   * timeout expires. */
  id: string;
  /** Short title (e.g. "Schema saved"). */
  title: string;
  /** Optional longer description. */
  description?: string;
  /** Visual tone. Defaults to 'info'. */
  tone?: ToastTone;
  /** Lifetime in ms. Default 4000. Pass 0 for "stay until dismissed". */
  durationMs?: number;
}

export interface SapuToastManagerApi {
  push(item: Omit<SapuToastItem, 'id'> & { id?: string }): string;
  dismiss(id: string): void;
  clear(): void;
  items: readonly SapuToastItem[];
}

interface SapuToasterProps {
  manager: SapuToastManagerApi;
}

/**
 * The visible toast stack. Mount this once near the root of the
 * app (the L7 engine will do this automatically). It subscribes to
 * the manager's items list and renders each as a plain div.
 */
export function SapuToaster(props: SapuToasterProps) {
  const [, force] = useState(0);

  useEffect(() => {
    const bump = () => force((n) => n + 1);
    // The manager exposes an Emitter on `.events` (added in this
    // file's factory). Subscribe + unsubscribe.
    const events = (props.manager as unknown as { events: { on: (e: string, fn: () => void) => void; off: (e: string, fn: () => void) => void } }).events;
    events.on('change', bump);
    return () => events.off('change', bump);
  }, [props.manager]);

  return h()(
    'div',
    {
      'data-sapu-toaster': '',
      className:
        'fixed bottom-4 right-4 flex flex-col gap-2 z-[10000] ' +
        'max-w-sm pointer-events-none',
    },
    ...props.manager.items.map((item) => {
      const tone = item.tone ?? 'info';
      const toneClass =
        tone === 'success' ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
        : tone === 'warning' ? 'border-amber-500 bg-amber-50 text-amber-900'
        : tone === 'error'   ? 'border-red-500 bg-red-50 text-red-900'
        :                      'border-slate-300 bg-white text-slate-900';
      return h()(
        'div',
        {
          key: item.id,
          role: 'status',
          'data-sapu-toast': '',
          className:
            `pointer-events-auto rounded-md border shadow-md p-3 ` +
            `flex items-start gap-2 text-xs ${toneClass}`,
        },
        h()(
          'div',
          { className: 'flex-1 min-w-0' },
          h()('div', { className: 'font-semibold' }, item.title),
          item.description
            ? h()('div', { className: 'text-[11px] mt-0.5 opacity-80' }, item.description)
            : null,
        ),
        h()(
          'button',
          {
            type: 'button',
            'aria-label': 'Dismiss toast',
            className:
              'text-[11px] px-1.5 py-0.5 rounded border border-current/30 ' +
              'hover:bg-black/5',
            onClick: () => props.manager.dismiss(item.id),
          },
          h()(CloseIcon, {}),
        ),
      );
    }),
  );
}

/**
 * A tiny in-process toast manager. Hosts construct one at startup
 * and pass it to `<SapuToaster>`. Plugins reach for the same
 * instance via `engine.toast` (L7).
 */
export function createToastManager(): SapuToastManagerApi {
  const items: SapuToastItem[] = [];
  const listeners = new Set<() => void>();
  let nextId = 0;
  const emit = () => listeners.forEach((fn) => fn());

  const dismissTimers = new Map<string, ReturnType<typeof setTimeout>>();

  const manager: SapuToastManagerApi = {
    push(input) {
      const id = input.id ?? `t${++nextId}`;
      const item: SapuToastItem = { id, tone: 'info', durationMs: 4000, ...input };
      items.push(item);
      emit();
      if (item.durationMs && item.durationMs > 0) {
        dismissTimers.set(
          id,
          setTimeout(() => {
            manager.dismiss(id);
          }, item.durationMs),
        );
      }
      return id;
    },
    dismiss(id) {
      const t = dismissTimers.get(id);
      if (t) {
        clearTimeout(t);
        dismissTimers.delete(id);
      }
      const idx = items.findIndex((it) => it.id === id);
      if (idx < 0) return;
      items.splice(idx, 1);
      emit();
    },
    clear() {
      for (const t of dismissTimers.values()) clearTimeout(t);
      dismissTimers.clear();
      items.length = 0;
      emit();
    },
    get items() {
      return items;
    },
  };
  // Attach a minimal event bus for SapuToaster to subscribe to.
  // Cast to any so we can add the optional `events` field without
  // a wider type; the consumer (SapuToaster) does its own cast.
  (manager as unknown as { events: { on: (e: string, fn: () => void) => void; off: (e: string, fn: () => void) => void } }).events = {
    on(_e: string, fn: () => void) { listeners.add(fn); },
    off(_e: string, fn: () => void) { listeners.delete(fn); },
  };
  return manager;
}
