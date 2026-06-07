/**
 * @monbolc/lowcode-plugin-setters — Setter registry
 *
 * Maps a `IPublicTypeFieldConfig`'s `setter` field to a pure-data
 * `SetterDescriptor` that the L4 settings panel turns into BaseUI
 * JSX. Built-in setters:
 *   - "Input"        : BaseUI.Input
 *   - "TextArea"     : raw <textarea> (no BaseUI equivalent)
 *   - "Number"       : BaseUI.NumberField
 *   - "Switch"       : BaseUI.Switch.Root
 *   - "Select"       : BaseUI.Select.Root
 *   - "ColorPicker"  : raw <input type="color"> (BaseUI has no picker)
 *   - "Slider"       : BaseUI.Slider.Root
 *
 * Setters are framework-agnostic data: they return a
 * `SetterDescriptor` (a string-typed vdom). The L4 settings panel
 * imports @base-ui-components/react and resolves the `type` to a
 * concrete component. This keeps `plugin-setters` free of any
 * BaseUI runtime dependency and makes the descriptor shape easy to
 * snapshot in tests.
 *
 * Styling is via Tailwind v4 utility class strings on the
 * `className` prop. The package ships a `styles.css` (compiled
 * from `src/styles.css` via `yarn build:css`) that pulls
 * Tailwind in.
 *
 * Consumers can register their own setters via `registerSetter(name, comp)`.
 */

import type { ReactNode } from 'react';
import type { IPublicTypeFieldConfig, IPublicTypeSetterConfig, JSONValue } from '@monbolc/lowcode-types';

export type SetterProps = {
  /** The current value. */
  value: JSONValue;
  /** Field config (for label, options, etc). */
  field: IPublicTypeFieldConfig;
  /** Called when the user commits a new value. */
  onChange: (value: JSONValue) => void;
  /** Optional: called for every keystroke (for live preview). */
  onInput?: (value: JSONValue) => void;
};

/**
 * The string-typed vdom. The L4 settings panel resolves `type` to
 * a BaseUI component (or to a raw HTML tag name — `input`,
 * `textarea`, etc. — which `React.createElement` handles
 * transparently). The `props` and `children` are forwarded as-is.
 *
 * PascalCase types refer to BaseUI components (e.g. `Switch` →
 * `@base-ui-components/react`'s `Switch.Root`).
 *
 * Lowercase types are raw HTML tags (`input`, `textarea`, `select`,
 * `button`, `div`, `span`).
 */
export type SetterType =
  | 'Input'        // @base-ui-components/react Input
  | 'NumberField'  // @base-ui-components/react NumberField.Root
  | 'Field'        // @base-ui-components/react Field.Root (compound; Control via children)
  | 'Switch'       // @base-ui-components/react Switch.Root
  | 'Select'       // @base-ui-components/react Select.Root
  | 'Slider'       // @base-ui-components/react Slider.Root
  | 'RadioGroup'   // @base-ui-components/react RadioGroup (G)
  | 'input'        // raw <input>
  | 'textarea'     // raw <textarea>
  | 'select'       // raw <select>
  | 'option'       // raw <option>
  | 'button'       // raw <button>
  | 'label'        // raw <label>
  | 'div'          // raw <div>
  | 'span';        // raw <span>

export interface SetterDescriptor {
  type: SetterType;
  /** Props to pass to the resolved component. Tailwind className lives here. */
  props?: Record<string, unknown>;
  /** Nested children. Each child is either a descriptor or a string. */
  children?: (SetterDescriptor | string)[];
}

/**
 * A setter is a pure function from `SetterProps` to `SetterDescriptor`.
 * It does NOT call `React.createElement` itself — that is the L4
 * settings panel's job. This separation keeps setters trivially
 * testable (snapshot the descriptor) and framework-agnostic.
 */
export type SetterComponent = (props: SetterProps) => SetterDescriptor;

const registry = new Map<string, SetterComponent>();

/** Register a custom setter under a name. */
export function registerSetter(name: string, component: SetterComponent): void {
  registry.set(name, component);
}

/** Look up a setter by name. Returns undefined if not registered. */
export function getSetter(name: string): SetterComponent | undefined {
  return registry.get(name);
}

/** Convenience: pick the right setter for a field. Falls back to "Input". */
export function pickSetter(field: IPublicTypeFieldConfig): SetterComponent | undefined {
  const name = typeof field.setter === 'string' ? field.setter : field.setter?.componentName;
  if (!name) return registry.get('Input');
  return registry.get(name) ?? registry.get('Input');
}

/** Resolve the field name to a setter name. */
export function resolveSetterName(setter: string | IPublicTypeSetterConfig | undefined): string {
  if (!setter) return 'Input';
  if (typeof setter === 'string') return setter;
  return setter.componentName;
}

/** Marker type for the built-in set. */
export const BUILT_IN_SETTERS = [
  'Input',
  'TextArea',
  'Number',
  'Switch',
  'Select',
  'ColorPicker',
  'Slider',
] as const;
export type BuiltInSetter = (typeof BUILT_IN_SETTERS)[number];

/**
 * Helper: render a label + setter side-by-side. Returns a
 * SetterDescriptor (NOT JSX) so the whole setter tree is pure
 * data until the L4 settings panel resolves it.
 */
export function withLabel(label: ReactNode, control: SetterDescriptor): SetterDescriptor {
  return {
    type: 'div',
    props: {
      className: 'flex flex-col gap-1',
    },
    children: [
      {
        type: 'label',
        props: { className: 'text-[11px] text-slate-600' },
        children: [typeof label === 'string' ? label : String(label)],
      },
      control,
    ],
  };
}
