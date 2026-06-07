/**
 * @monbolc/lowcode-editor-skeleton — Modal (DialogDock lite)
 *
 * A small wrapper around BaseUI `Dialog` that gives the editor a
 * uniform "are you sure?" / quick prompt surface. Sapu's stance:
 * one component, no `Dock` registry — if a host wants to stack
 * dialogs, they manage the array themselves and render the right
 * one based on state.
 *
 * Tailwind v4 utilities for styling. No hand-rolled CSS.
 */

import { Dialog } from '@base-ui-components/react/dialog';
import { adapter } from '@monbolc/lowcode-renderer-core';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface SapuModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Primary action button label. */
  confirmLabel?: string;
  /** Secondary action label. Default 'Cancel'. */
  cancelLabel?: string;
  /** Visual tone for the confirm button. Default 'primary' (blue). */
  tone?: 'primary' | 'danger';
  onConfirm?: () => void;
  /** Optional arbitrary body content (between description and footer). */
  children?: React.ReactNode;
}

const TONE_CLS: Record<NonNullable<SapuModalProps['tone']>, string> = {
  primary: 'bg-blue-600 hover:bg-blue-700 text-white',
  danger:  'bg-red-600 hover:bg-red-700 text-white',
};

/**
 * A controlled modal dialog. The host owns the `open` state.
 *
 * Example:
 *   <SapuModal open={confirming} onOpenChange={setConfirming}
 *     title="Reset schema?" description="This clears all edits."
 *     confirmLabel="Reset" tone="danger" onConfirm={onReset} />
 */
export function SapuModal(props: SapuModalProps) {
  const tone = props.tone ?? 'primary';
  const cancelLabel = props.cancelLabel ?? 'Cancel';
  const confirmLabel = props.confirmLabel ?? 'OK';
  return h()(
    Dialog.Root,
    { open: props.open, onOpenChange: props.onOpenChange },
    h()(
      Dialog.Portal,
      null,
      h()(
        Dialog.Backdrop,
        { className: 'fixed inset-0 bg-black/40 z-[9999]' },
      ),
      h()(
        Dialog.Popup,
        {
          className:
            'fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ' +
            'z-[10001] bg-white rounded-lg shadow-xl border border-slate-200 ' +
            'w-[min(420px,calc(100vw-2rem))] p-5 outline-none',
        },
        h()(
          Dialog.Title,
          { className: 'text-sm font-semibold text-slate-900' },
          props.title,
        ),
        props.description
          ? h()(
              Dialog.Description,
              { className: 'mt-1 text-xs text-slate-600' },
              props.description,
            )
          : null,
        props.children
          ? h()('div', { className: 'mt-3 text-xs text-slate-700' }, props.children)
          : null,
        h()(
          'div',
          { className: 'mt-5 flex justify-end gap-2' },
          h()(
            Dialog.Close,
            {
              className:
                'text-xs px-3 py-1.5 rounded border border-slate-300 ' +
                'bg-white hover:bg-slate-50 text-slate-700',
            },
            cancelLabel,
          ),
          props.onConfirm
            ? h()(
                'button',
                {
                  type: 'button',
                  onClick: () => {
                    props.onConfirm?.();
                    props.onOpenChange(false);
                  },
                  className:
                    `text-xs px-3 py-1.5 rounded ${TONE_CLS[tone]}`,
                },
                confirmLabel,
              )
            : null,
        ),
      ),
    ),
  );
}
