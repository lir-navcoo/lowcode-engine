/**
 * @monbolc/lowcode-editor-skeleton — SettingsPanel
 *
 * Right pane of the editor. Lists the props of the currently
 * selected node and lets the user edit them. Subscribes to the
 * project's selection + document events.
 */

import { useEffect, useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Project } from '@monbolc/lowcode-designer';
import type { JSONValue } from '@monbolc/lowcode-types';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface SettingsPanelProps {
  project: Project;
}

interface EditableProp {
  key: string;
  value: JSONValue;
}

function formatValue(v: JSONValue): string {
  if (v === null) return 'null';
  if (typeof v === 'string') return JSON.stringify(v);
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

function parseValue(s: string): JSONValue {
  if (s === 'null') return null;
  if (s === 'true') return true;
  if (s === 'false') return false;
  if (s !== '' && !Number.isNaN(Number(s))) return Number(s);
  if (s.startsWith('{') || s.startsWith('[') || s.startsWith('"')) {
    try { return JSON.parse(s); } catch { /* fall through */ }
  }
  return s;
}

export function SettingsPanel(props: SettingsPanelProps) {
  const [, force] = useState(0);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>('');

  // Re-render whenever selection or document changes.
  useEffect(() => {
    const bump = () => force((n) => n + 1);
    props.project.events.on('selectionChanged', bump);
    props.project.document.events.on('nodePropsChanged', bump);
    props.project.document.events.on('nodeRenamed', bump);
    return () => {
      props.project.events.off('selectionChanged', bump);
      props.project.document.events.off('nodePropsChanged', bump);
      props.project.document.events.off('nodeRenamed', bump);
    };
  }, [props.project]);

  // Local Tailwind classnames (was: sapu-skel-empty / sapu-skel-settings).
  const CN_EMPTY = 'text-slate-400 italic p-6 text-center';
  const CN_ROW = 'flex items-center gap-1';

  const selected = props.project.getSelectedNodes();
  if (selected.length === 0) {
    return h()('div', { className: CN_EMPTY },
      'No selection. Click a node in the outline to edit it.',
    );
  }
  if (selected.length > 1) {
    return h()('div', { className: CN_EMPTY },
      `${selected.length} nodes selected. Settings show one at a time.`,
    );
  }

  const node = selected[0];
  const propsMap = node.props as Record<string, JSONValue>;

  const startEdit = (key: string, current: JSONValue) => {
    setEditingKey(key);
    setDraft(formatValue(current));
  };

  const commit = (key: string) => {
    if (editingKey !== key) return;
    const v = parseValue(draft);
    props.project.document.setProps(node, { [key]: v });
    setEditingKey(null);
  };

  return h()('div', { className: 'p-3' },
    h()('div', { className: 'mb-3' },
      h()('div', { className: 'text-[11px] text-slate-500' }, 'Component'),
      h()('div', { className: 'flex items-center gap-1.5 mt-1' },
        h()('code', { className: 'text-[13px] flex-1 font-semibold' }, node.componentName),
        h()('button', {
          onClick: () => {
            const newName = prompt('Rename component to:', node.componentName);
            if (newName && newName !== node.componentName) {
              props.project.document.rename(node, newName);
            }
          },
          className: 'text-[11px] px-1.5 py-0.5 rounded border border-slate-300 bg-white hover:bg-slate-50',
        }, 'Rename'),
      ),
    ),
    h()('div', { className: 'text-[11px] text-slate-500 mb-1.5' },
      `Props (${Object.keys(propsMap).length})`),
    h()('div', { className: 'flex flex-col gap-1' },
      Object.entries(propsMap).map(([k, v]) =>
        h()('div', { key: k, className: CN_ROW },
          h()('div', { className: 'w-20 text-xs text-slate-700' }, k),
          editingKey === k
            ? h()('input', {
                autoFocus: true,
                value: draft,
                onChange: (e: { target: { value: string } }) => setDraft(e.target.value),
                onBlur: () => commit(k),
                onKeyDown: (e: { key: string }) => {
                  if (e.key === 'Enter') commit(k);
                  if (e.key === 'Escape') setEditingKey(null);
                },
                className: 'flex-1 text-xs px-1.5 py-0.5 border border-blue-500 rounded',
              })
            : h()('div', {
                onClick: () => startEdit(k, v),
                className: 'flex-1 text-xs px-1.5 py-0.5 bg-slate-100 rounded cursor-text font-mono',
              }, formatValue(v)),
        ),
      ),
    ),
  );
}
