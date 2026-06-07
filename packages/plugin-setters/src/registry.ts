/**
 * @monbolc/lowcode-plugin-setters — Setter registry
 *
 * Maps a `IPublicTypeFieldConfig`'s `setter` field to a concrete
 * React component. Built-in setters:
 *   - "Input"        : text input (default)
 *   - "TextArea"     : multi-line text
 *   - "Number"       : number input
 *   - "Switch"       : on/off
 *   - "Select"       : dropdown
 *   - "ColorPicker"  : color input
 *   - "Slider"       : number slider with min/max
 *
 * Consumers can register their own setters via `registerSetter(name, comp)`.
 */

import type { ComponentType, ReactNode } from 'react';
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

export type SetterComponent = ComponentType<SetterProps>;

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

/** Helper: render a label + setter side-by-side. */
export function withLabel(label: ReactNode, control: ReactNode): ReactNode {
  return {
    type: 'div',
    props: {
      style: { display: 'flex', flexDirection: 'column', gap: 4 },
      children: [
        { type: 'label', props: { style: { fontSize: 11, color: '#475569' }, children: label } },
        control,
      ],
    },
  };
}
