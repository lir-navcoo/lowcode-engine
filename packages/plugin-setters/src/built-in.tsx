/**
 * @monbolc/lowcode-plugin-setters — built-in setters (BaseUI + Tailwind v4)
 *
 * 7 setters, each returning a pure `SetterDescriptor` (no React,
 * no createElement). The L4 settings panel resolves the `type`
 * field to the actual BaseUI component or HTML tag and renders it.
 *
 * Component-name mapping (per `feedback-react19-and-baseui`):
 *
 *   Setter        | descriptor.type | what L4 panel renders
 *   --------------|-----------------|--------------------------------------
 *   Input         | 'Input'         | @base-ui-components/react Input
 *   TextArea      | 'textarea'      | raw <textarea>  (no BaseUI equivalent)
 *   Number        | 'NumberField'   | @base-ui-components/react NumberField.Root
 *   Switch        | 'Switch'        | @base-ui-components/react Switch.Root
 *   Select        | 'Select'        | @base-ui-components/react Select.Root
 *   ColorPicker   | 'input'         | raw <input type="color">  (BaseUI has no color picker)
 *   Slider        | 'Slider'        | @base-ui-components/react Slider.Root
 *
 * Styling is via Tailwind v4 utility classes on the `className`
 * prop of the descriptor. The `src/styles.css` file imports
 * `tailwindcss`; the compiled output (`lib/styles.css`) is
 * published to npm and also picked up by the demo's
 * `@tailwindcss/vite` plugin.
 */

import type { JSONValue } from '@monbolc/lowcode-types';

import type { SetterComponent, SetterDescriptor } from './registry';

/** Shared Tailwind classes for the standard setter input look. */
const INPUT_CLASS =
  'w-full px-2 py-1 text-xs text-slate-900 border border-slate-300 rounded ' +
  'focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 ' +
  'disabled:bg-slate-50 disabled:text-slate-400';

/* ------------------------------------------------------------------ *
 *  Input — single-line text via BaseUI.Input                          *
 * ------------------------------------------------------------------ */

const Input: SetterComponent = ({ value, onChange, field }) => {
  const v = value === null || value === undefined ? '' : String(value);
  // The 'Input' setter also handles "number" fields by detecting
  // the field name / default value type. The L4 panel passes
  // `type: 'number'` to BaseUI.Input which is a native <input>.
  const isNumber =
    field.name.toLowerCase().includes('number') ||
    typeof field.defaultValue === 'number';
  const desc: SetterDescriptor = {
    type: 'Input',
    props: {
      className: INPUT_CLASS,
      defaultValue: v,
      type: isNumber ? 'number' : 'text',
      onBlur: (e: { target: { value: string } }) => {
        const newVal = isNumber ? Number(e.target.value) : e.target.value;
        onChange(newVal as JSONValue);
      },
    },
  };
  return desc;
};

/* ------------------------------------------------------------------ *
 *  TextArea — multi-line text via raw <textarea> (no BaseUI equivalent) *
 * ------------------------------------------------------------------ */

const TextArea: SetterComponent = ({ value, onChange }) => {
  const v = value === null || value === undefined ? '' : String(value);
  return {
    type: 'textarea',
    props: {
      className: INPUT_CLASS + ' resize-y min-h-[60px]',
      defaultValue: v,
      rows: 3,
      onBlur: (e: { target: { value: string } }) => onChange(e.target.value),
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Number — BaseUI.NumberField (root + native group of inputs)         *
 * ------------------------------------------------------------------ */

const NumberSetter: SetterComponent = ({ value, onChange, field }) => {
  const v = typeof value === 'number' ? value : 0;
  // BaseUI.NumberField is compound: Root, Group, Decrement, Increment,
  // Input. We render the Root (which is the fieldset wrapper) with
  // a group of +/- buttons. For now we render just the Root + an
  // Input child; the L4 panel will resolve the children.
  return {
    type: 'NumberField',
    props: {
      className: 'flex items-center gap-1',
      value: v,
      onValueChange: (nv: number | null) => onChange((nv ?? 0) as JSONValue),
      min: field.extraProps?.min as number | undefined,
      max: field.extraProps?.max as number | undefined,
      step: field.extraProps?.step as number | undefined,
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Switch — BaseUI.Switch.Root                                         *
 * ------------------------------------------------------------------ */

const Switch: SetterComponent = ({ value, onChange }) => {
  const isOn = value === true;
  return {
    type: 'Switch',
    props: {
      className:
        'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full ' +
        'border border-transparent transition-colors ' +
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ' +
        (isOn ? 'bg-blue-500' : 'bg-slate-300'),
      checked: isOn,
      onCheckedChange: (next: boolean) => onChange(next as JSONValue),
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Select — BaseUI.Select.Root                                         *
 * ------------------------------------------------------------------ */

const Select: SetterComponent = ({ value, onChange, field }) => {
  const options: Array<{ label: string; value: JSONValue }> =
    (field.extraProps?.options as Array<{ label: string; value: JSONValue }>) ?? [];
  // BaseUI.Select is compound (Root, Trigger, Value, Icon, Portal,
  // Backdrop, Positioner, Popup, List, Item, ItemIndicator, ...).
  // For setters we use the simplest trigger-and-list pattern; the
  // L4 panel wires up the children. To keep the descriptor pure,
  // we put the options as a child descriptor array that the L4
  // panel will recursively render.
  return {
    type: 'Select',
    props: {
      value: String(value),
      onValueChange: (next: string) => {
        const opt = options.find((o) => String(o.value) === next);
        onChange(opt ? opt.value : (next as JSONValue));
      },
    },
    children: options.map((o, i) => ({
      type: 'option' as SetterDescriptor['type'],
      props: { key: `opt-${i}`, value: String(o.value) },
      children: [o.label],
    })),
  };
};

/* ------------------------------------------------------------------ *
 *  ColorPicker — raw <input type="color"> (BaseUI has no color picker)  *
 * ------------------------------------------------------------------ */

const ColorPicker: SetterComponent = ({ value, onChange }) => {
  const v = typeof value === 'string' ? value : '#000000';
  return {
    type: 'input',
    props: {
      className:
        'h-7 w-9 cursor-pointer rounded border border-slate-300 p-0 ' +
        'focus:outline-none focus:border-blue-500',
      type: 'color',
      defaultValue: v,
      onBlur: (e: { target: { value: string } }) => onChange(e.target.value),
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Slider — BaseUI.Slider.Root                                         *
 * ------------------------------------------------------------------ */

const Slider: SetterComponent = ({ value, onChange, field }) => {
  const v = typeof value === 'number' ? value : 0;
  return {
    type: 'Slider',
    props: {
      className: 'flex w-full items-center gap-2',
      value: v,
      onValueChange: (next: number) => onChange(next as JSONValue),
      min: (field.extraProps?.min as number | undefined) ?? 0,
      max: (field.extraProps?.max as number | undefined) ?? 100,
      step: (field.extraProps?.step as number | undefined) ?? 1,
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Public export                                                       *
 * ------------------------------------------------------------------ */

import { registerSetter } from './registry';

let _registered = false;

/** Register all built-in setters. Idempotent. */
export function registerBuiltInSetters(): void {
  if (_registered) return;
  registerSetter('Input', Input);
  registerSetter('TextArea', TextArea);
  registerSetter('Number', NumberSetter);
  registerSetter('Switch', Switch);
  registerSetter('Select', Select);
  registerSetter('ColorPicker', ColorPicker);
  registerSetter('Slider', Slider);
  _registered = true;
}

export {
  Input,
  TextArea,
  NumberSetter as Number,
  Switch,
  Select,
  ColorPicker,
  Slider,
};
