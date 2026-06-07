/**
 * @monbolc/lowcode-editor-skeleton — Setter resolver
 *
 * Bridge between the framework-agnostic `SetterDescriptor` shape
 * (from `@monbolc/lowcode-plugin-setters`) and the actual React
 * components (BaseUI primitives + raw HTML tags). The setters
 * themselves return pure data — they don't import BaseUI, so the
 * L4 settings panel is the only place that needs to know which
 * BaseUI component (or raw HTML tag) backs each setter type.
 *
 * This file is the only place in sapu that imports
 * `@base-ui-components/react` for setters. Plugin-setters stays
 * framework-agnostic; editor-skeleton (this file + settings-panel)
 * is the wire-up layer.
 */

import * as BaseUI from '@base-ui-components/react';
import { createElement, type ComponentType, type ReactElement, type ReactNode } from 'react';

import type {
  SetterDescriptor,
  SetterType,
} from '@monbolc/lowcode-plugin-setters';

/**
 * Map from `SetterType` (string) to a React component type.
 *
 * PascalCase keys map to BaseUI components (e.g. `Switch` →
 * `BaseUI.Switch.Root`). Lowercase keys are raw HTML tag names —
 * `React.createElement` accepts strings as tag names and renders
 * the corresponding DOM element.
 *
 * `Field` and `NumberField` are compound components; we render
 * their `.Root` which is the fieldset/wrapper that the consumer
 * (settings panel) can pass children to. The descriptor's
 * `children` slot is forwarded.
 */
const LOOKUP: Record<SetterType, ComponentType<any> | string> = {
  'Input': BaseUI.Input as ComponentType<any>,
  'NumberField': BaseUI.NumberField.Root as ComponentType<any>,
  'Field': BaseUI.Field.Root as ComponentType<any>,
  'Switch': BaseUI.Switch.Root as ComponentType<any>,
  'Select': BaseUI.Select.Root as ComponentType<any>,
  'Slider': BaseUI.Slider.Root as ComponentType<any>,
  'RadioGroup': BaseUI.RadioGroup as ComponentType<any>,
  'input': 'input',
  'textarea': 'textarea',
  'select': 'select',
  'option': 'option',
  'button': 'button',
  'label': 'label',
  'div': 'div',
  'span': 'span',
};

/**
 * Recursively render a `SetterDescriptor` to a React element.
 *
 * Resolves `desc.type` against `LOOKUP`, then `createElement`s the
 * result with `desc.props` and the recursively-rendered children.
 * String children are passed as-is. The `key` prop, if present in
 * `desc.props`, is forwarded to `createElement` so React keeps the
 * element identity stable across re-renders (important for arrays
 * of options, e.g. Select's children).
 */
export function renderDescriptor(desc: SetterDescriptor): ReactElement {
  const type = LOOKUP[desc.type];
  const props = (desc.props ?? {}) as Record<string, unknown>;
  const children = (desc.children ?? []).map((c): ReactNode =>
    typeof c === 'string' ? c : renderDescriptor(c),
  );
  return createElement(type, props, ...children);
}

/**
 * Infer a setter name from a value's runtime type. The settings
 * panel doesn't have a `IPublicTypeFieldConfig` per prop; we
 * construct a minimal one on the fly. The field name pattern
 * (`*color*`, `*number*`) lets us pick a more specific setter than
 * the type alone would suggest.
 *
 *   boolean                → 'Switch'
 *   number                 → 'Number' (BaseUI.NumberField)
 *   string + 'color' name  → 'ColorPicker'
 *   string                 → 'Input'
 *   object / array / null  → 'TextArea' (JSON-serialized)
 */
export function inferSetterName(value: unknown, key: string): string {
  if (typeof value === 'boolean') return 'Switch';
  if (typeof value === 'number') return 'Number';
  if (typeof value === 'string') {
    if (key.toLowerCase().includes('color')) return 'ColorPicker';
    if (key.toLowerCase().includes('slider') || key.toLowerCase().includes('range')) return 'Slider';
    return 'Input';
  }
  return 'TextArea';
}
