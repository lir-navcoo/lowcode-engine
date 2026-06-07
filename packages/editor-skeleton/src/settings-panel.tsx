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

  const selected = props.project.getSelectedNodes();
  if (selected.length === 0) {
    return h()('div', { className: 'sapu-skel-empty' },
      'No selection. Click a node in the outline to edit it.',
    );
  }
  if (selected.length > 1) {
    return h()('div', { className: 'sapu-skel-empty' },
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

  return h()('div', { className: 'sapu-skel-settings', style: { padding: 12 } },
    h()('div', { style: { marginBottom: 12 } },
      h()('div', { style: { fontSize: 11, color: '#64748b' } }, 'Component'),
      h()('div', { style: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 } },
        h()('code', { style: { fontSize: 13, flex: 1, fontWeight: 600 } }, node.componentName),
        h()('button', {
          onClick: () => {
            const newName = prompt('Rename component to:', node.componentName);
            if (newName && newName !== node.componentName) {
              props.project.document.rename(node, newName);
            }
          },
          style: { fontSize: 11, padding: '2px 6px' },
        }, 'Rename'),
      ),
    ),
    h()('div', { style: { fontSize: 11, color: '#64748b', marginBottom: 6 } },
      `Props (${Object.keys(propsMap).length})`),
    h()('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
      Object.entries(propsMap).map(([k, v]) =>
        h()('div', { key: k, style: { display: 'flex', gap: 4, alignItems: 'center' } },
          h()('div', { style: { width: 80, fontSize: 12, color: '#334155' } }, k),
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
                style: { flex: 1, fontSize: 12, padding: '2px 6px', border: '1px solid #3b82f6' },
              })
            : h()('div', {
                onClick: () => startEdit(k, v),
                style: {
                  flex: 1, fontSize: 12, padding: '2px 6px',
                  background: '#f1f5f9', borderRadius: 3, cursor: 'text',
                  fontFamily: 'monospace',
                },
              }, formatValue(v)),
        ),
      ),
    ),
  );
}
