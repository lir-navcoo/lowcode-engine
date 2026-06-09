/**
 * @monbolc/lowcode-editor-skeleton — setter field wrappers
 *
 * Five small "field-level" wrappers used when the host edits a
 * component's `configure` (the meta-config that defines what
 * setters appear in the right panel). Each wrapper is bound to a
 * single `IPublicTypeFieldConfig` and renders the matching BaseUI
 * primitive:
 *
 * - `ExtraPropsField` — multi-line key-value edit (raw <textarea>
 * holding a JSON object; the user types `{"min":0,"max":100}`)
 * - `TitleField` — single-line title text (BaseUI Input)
 * - `DescriptionField` — multi-line description (raw <textarea>;
 * no BaseUI equivalent)
 * - `SetterTypeField` — dropdown of registered setter names
 * (BaseUI Select; options come from
 * `getRegisteredSetterNames()` in `@monbolc/lowcode-plugin-setters`)
 * - `DefaultValueField` — JSON textarea with a one-line schema
 * check hint ("valid JSON" / "invalid: <reason>")
 *
 * Edge cases:
 * - `SetterTypeField`: when the field's `setter` is an unknown
 * name, render a gray "Unknown setter: <name>" placeholder
 * instead of throwing. The user can still pick a known name
 * from the dropdown to repair the field.
 * - All wrappers accept the standard `IPublicTypeFieldConfig`
 * shape from `@monbolc/lowcode-types` (re-exported from the L3
 * designer's `SettingField` for convenience, but functionally
 * identical).
 */

import { useState } from 'react';
import { Input } from '@base-ui-components/react/input';
import { Select } from '@base-ui-components/react/select';
import { adapter } from '@monbolc/lowcode-renderer-core';
import { getRegisteredSetterNames } from '@monbolc/lowcode-plugin-setters';
import type { IPublicTypeFieldConfig, JSONValue } from '@monbolc/lowcode-types';

const h = (): ((type: unknown, props?: unknown, ...children: unknown[]) => unknown) =>
 adapter.getRuntime().createElement as (type: unknown, props?: unknown, ...children: unknown[]) => unknown;

/** Shared Tailwind class for the standard setter-row look. */
const ROW_CLS = 'flex flex-col gap-1 text-[11px] text-slate-700';
const LABEL_CLS = 'font-medium text-slate-700';
const CONTROL_CLS =
 'w-full px-2 py-1 text-xs text-slate-900 border border-slate-300 rounded ' +
 'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500';

/** Read the current setter name from a `IPublicTypeFieldConfig`. */
function readSetterName(field: IPublicTypeFieldConfig): string {
 if (typeof field.setter === 'string') return field.setter;
 if (field.setter && typeof field.setter === 'object') {
 const name = (field.setter as { componentName?: unknown }).componentName;
 return typeof name === 'string' ? name : '';
 }
 return '';
}

/**
 * `ExtraPropsField` — multi-line JSON object editor.
 *
 * The user types a JSON object; on blur we parse + write back.
 * Invalid JSON keeps the raw text and shows a one-line error
 * hint so the user can repair it.
 */
export function ExtraPropsField(props: {
 field: IPublicTypeFieldConfig;
 onChange: (next: IPublicTypeFieldConfig) => void;
}) {
 const initial = JSON.stringify(props.field.extraProps ?? {}, null,2);
 const [text, setText] = useState(initial);
 const [error, setError] = useState<string | null>(null);
 return h()(
 'div',
 { className: ROW_CLS },
 h()('label', { className: LABEL_CLS }, 'extraProps (JSON)'),
 h()('textarea', {
 className: CONTROL_CLS + ' resize-y min-h-[80px] font-mono',
 value: text,
 rows:4,
 onChange: (e: { target: { value: string } }) => setText(e.target.value),
 onBlur: () => {
 try {
 const parsed = JSON.parse(text);
 setError(null);
 props.onChange({ ...props.field, extraProps: parsed as Record<string, unknown> });
 } catch (err) {
 setError((err as Error).message);
 }
 },
 }),
 error
 ? h()('div', { className: 'text-[10px] text-red-600' }, `invalid JSON: ${error}`)
 : null,
 );
}

/**
 * `TitleField` — single-line title text via BaseUI Input.
 */
export function TitleField(props: {
 field: IPublicTypeFieldConfig;
 onChange: (next: IPublicTypeFieldConfig) => void;
}) {
 const value = typeof props.field.title === 'string' ? props.field.title : '';
 return h()(
 'div',
 { className: ROW_CLS },
 h()('label', { className: LABEL_CLS }, 'title'),
 h()(Input, {
 className: CONTROL_CLS,
 value,
 onChange: (e: { target: { value: string } }) =>
 props.onChange({ ...props.field, title: e.target.value }),
 }),
 );
}

/**
 * `DescriptionField` — multi-line description via raw <textarea>.
 */
export function DescriptionField(props: {
 field: IPublicTypeFieldConfig;
 onChange: (next: IPublicTypeFieldConfig) => void;
}) {
 const value = typeof props.field.description === 'string' ? props.field.description : '';
 const [text, setText] = useState(value);
 return h()(
 'div',
 { className: ROW_CLS },
 h()('label', { className: LABEL_CLS }, 'description'),
 h()('textarea', {
 className: CONTROL_CLS + ' resize-y min-h-[60px]',
 value: text,
 rows:3,
 onChange: (e: { target: { value: string } }) => setText(e.target.value),
 onBlur: () => props.onChange({ ...props.field, description: text }),
 }),
 );
}

/**
 * `SetterTypeField` — dropdown of registered setter names.
 *
 * Options come from `getRegisteredSetterNames()` so the dropdown
 * always reflects the live registry (built-ins + any host-
 * registered customs). Unknown names render as a gray
 * "Unknown setter: xxx" placeholder — the user can pick a known
 * name from the dropdown to repair the field. No throw.
 */
export function SetterTypeField(props: {
 field: IPublicTypeFieldConfig;
 onChange: (next: IPublicTypeFieldConfig) => void;
}) {
 const names = getRegisteredSetterNames();
 const current = readSetterName(props.field);
 const isKnown = current !== '' && names.includes(current);
 return h()(
 'div',
 { className: ROW_CLS },
 h()('label', { className: LABEL_CLS }, 'setter'),
 isKnown
 ? h()(
 Select.Root,
 {
 value: current,
 onValueChange: (next: string | null) => {
 if (!next) return;
 props.onChange({ ...props.field, setter: next });
 },
 },
 h()(
 Select.Trigger,
 {
 className:
 CONTROL_CLS +
 ' flex items-center justify-between gap-2 text-left',
 },
 h()(
 Select.Value,
 null,
 current,
 ),
 h()('span', { className: 'text-slate-400 text-[10px]' }, '▾'),
 ),
 h()(
 Select.Portal,
 null,
 h()(
 Select.Positioner,
 { side: 'bottom', sideOffset:4, className: 'z-[10003] outline-none' },
 h()(
 Select.Popup,
 {
 className:
 'bg-white border border-slate-200 rounded shadow-lg max-h-60 overflow-auto ' +
 'text-xs',
 },
 h()(
 Select.List,
 null,
 ...names.map((n: string) =>
 h()(
 Select.Item,
 {
 key: n,
 value: n,
 className:
 'px-2 py-1 cursor-pointer hover:bg-blue-50 data-[highlighted]:bg-blue-50 ' +
 'data-[selected]:font-semibold',
 },
 h()(Select.ItemText, null, n),
 ),
 ),
 ),
 ),
 ),
 ),
 )
 : h()(
 'div',
 { className: CONTROL_CLS + ' text-slate-400 italic cursor-not-allowed' },
 `Unknown setter: ${current || '(empty)'}`,
 ),
 );
}

/**
 * `DefaultValueField` — JSON editor with a one-line validation
 * hint. Parses on blur; if the parse fails, the user sees the
 * reason and can repair.
 */
export function DefaultValueField(props: {
 field: IPublicTypeFieldConfig;
 onChange: (next: IPublicTypeFieldConfig) => void;
}) {
 const initial = JSON.stringify(props.field.defaultValue, null,2);
 const [text, setText] = useState(initial);
 const [error, setError] = useState<string | null>(null);
 return h()(
 'div',
 { className: ROW_CLS },
 h()('label', { className: LABEL_CLS }, 'defaultValue (JSON)'),
 h()('textarea', {
 className: CONTROL_CLS + ' resize-y min-h-[80px] font-mono',
 value: text,
 rows:4,
 onChange: (e: { target: { value: string } }) => setText(e.target.value),
 onBlur: () => {
 try {
 const parsed = JSON.parse(text);
 setError(null);
 props.onChange({ ...props.field, defaultValue: parsed as JSONValue });
 } catch (err) {
 setError((err as Error).message);
 }
 },
 }),
 error
 ? h()('div', { className: 'text-[10px] text-red-600' }, `invalid JSON: ${error}`)
 : h()('div', { className: 'text-[10px] text-slate-400' }, 'valid JSON — committed on blur'),
 );
}
