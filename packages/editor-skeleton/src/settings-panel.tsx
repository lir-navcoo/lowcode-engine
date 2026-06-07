/**
 * @monbolc/lowcode-editor-skeleton — SettingsPanel
 *
 * Right pane of the editor. Lists the props of the currently
 * selected node and lets the user edit them.
 *
 * Wiring (P1.3): each prop is rendered through the L2.5
 * `plugin-setters` API:
 *   1. Infer the setter name from the value's runtime type +
 *      prop key pattern (`inferSetterName(value, key)`).
 *   2. Look up the setter via `pickSetter(field)` (we construct a
 *      minimal `IPublicTypeFieldConfig` on the fly).
 *   3. Call the setter to get a `SetterDescriptor` (pure data).
 *   4. Render via `renderDescriptor(desc)` which resolves the
 *      descriptor's `type` to a BaseUI component (or raw HTML
 *      tag) and `createElement`s it.
 *
 * No more hand-rolled JSON value editor — the L4 panel now uses
 * the same setters downstream users will register for their own
 * component props.
 */

import { useEffect, useState } from 'react';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { Project } from '@monbolc/lowcode-designer';
import {
  pickSetter,
  registerBuiltInSetters,
  type SetterComponent,
  type SetterProps,
} from '@monbolc/lowcode-plugin-setters';
import type { IPublicTypeFieldConfig, JSONValue } from '@monbolc/lowcode-types';

import { renderDescriptor, inferSetterName } from './setter-resolver';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
  adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

export interface SettingsPanelProps {
  project: Project;
  /**
   * Optional per-(component, prop) override of which setter name to
   * use. When the selected node's `componentName` and a prop key
   * match, the named setter is used instead of the inferred one.
   *
   * Format: `{ [componentName]: { [propName]: setterName } }`.
   * Looked up via the **runtime** `getSetter` registry, so any setter
   * the host registered via `registerSetter(name, ...)` is fair game.
   */
  setterConfig?: Record<string, Record<string, string>>;
}

// Ensure the 7 built-in setters are registered before the first
// prop is rendered. Idempotent.
let _settersRegistered = false;
function ensureSetters(): void {
  if (_settersRegistered) return;
  registerBuiltInSetters();
  _settersRegistered = true;
}

/**
 * Build a minimal `IPublicTypeFieldConfig` for a (key, value) pair
 * when the schema doesn't carry one. The settings panel only
 * renders an existing node's props (not a meta-driven form), so
 * a thin ad-hoc field config is all the setter API needs.
 */
function makeField(key: string, value: JSONValue, setterName: string): IPublicTypeFieldConfig {
  return {
    name: key,
    path: [key],
    type: typeof value === 'number' ? 'number'
        : typeof value === 'boolean' ? 'boolean'
        : typeof value === 'string' ? 'string'
        : 'object',
    title: key,
    setter: setterName,
    defaultValue: value,
  } as unknown as IPublicTypeFieldConfig;
}

/**
 * Pick a setter for the given (key, value). Returns undefined if
 * the inferred setter name isn't registered (fall through to a
 * hand-rolled input below).
 *
 * `configuredSetter` — when the host declared a per-(component, prop)
 * setter via `setterConfig`, use that name instead of inferring.
 */
function pickSetterFor(
  key: string,
  value: JSONValue,
  configuredSetter: string | undefined,
): SetterComponent | undefined {
  const setterName = configuredSetter ?? inferSetterName(value, key);
  const field = makeField(key, value, setterName);
  return pickSetter(field);
}

export function SettingsPanel(props: SettingsPanelProps) {
  ensureSetters();
  const [, force] = useState(0);

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

  // Local Tailwind classnames.
  const CN_EMPTY = 'text-slate-400 italic p-6 text-center';
  const CN_ROW = 'flex items-center gap-2';
  const CN_LABEL = 'w-20 text-xs text-slate-700 shrink-0';
  const CN_CONTROL = 'flex-1 min-w-0';

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

  // Build a setter call closure that writes back into the document.
  const onChangeFor = (key: string) => (next: JSONValue) => {
    props.project.document.setProps(node, { [key]: next });
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
    h()('div', { className: 'flex flex-col gap-2' },
      Object.entries(propsMap).map(([k, v]) => {
        const configured = props.setterConfig?.[node.componentName]?.[k];
        const setter = pickSetterFor(k, v, configured);
        if (!setter) {
          // Should never happen — we always fall back to 'Input' in pickSetter.
          return h()('div', { key: k, className: CN_ROW },
            h()('div', { className: CN_LABEL }, k),
            h()('div', { className: CN_CONTROL, children: String(v) }),
          );
        }
        // For TextArea (used for objects/arrays) the setter expects
        // a string, not a JSON value — serialize the value.
        const setterName = inferSetterName(v, k);
        const valueForSetter: JSONValue =
          setterName === 'TextArea' && v !== null && typeof v === 'object'
            ? (JSON.stringify(v) as unknown as JSONValue)
            : v;
        const setterProps: SetterProps = {
          value: valueForSetter,
          field: makeField(k, valueForSetter, setterName),
          onChange: (next) => {
            // If the user edits a JSON-TextArea, parse it back.
            const realNext: JSONValue =
              setterName === 'TextArea' && v !== null && typeof v === 'object' && typeof next === 'string'
                ? (safeJsonParse(next) as JSONValue)
                : next;
            onChangeFor(k)(realNext);
          },
        };
        const desc = setter(setterProps);
        return h()('div', { key: k, className: CN_ROW },
          h()('div', { className: CN_LABEL }, k),
          h()('div', { className: CN_CONTROL }, renderDescriptor(desc)),
        );
      }),
    ),
  );
}

/** Tolerant JSON parse. Falls back to the raw string. */
function safeJsonParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
