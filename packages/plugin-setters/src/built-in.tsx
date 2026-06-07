/**
 * @monbolc/lowcode-plugin-setters — built-in setters (BaseUI)
 *
 * 7 setters: Input, TextArea, Number, Switch, Select, ColorPicker, Slider.
 * Built on @base-ui-components/react primitives.
 */

import { useState } from 'react';
import type { JSONValue } from '@monbolc/lowcode-types';
import { isPlainObject } from '@monbolc/lowcode-utils';

import type { SetterComponent } from './registry';

/* ------------------------------------------------------------------ *
 *  Input — single-line text or number                                  *
 * ------------------------------------------------------------------ */

const Input: SetterComponent = ({ value, onChange, field }) => {
  const v = value === null || value === undefined ? '' : String(value);
  const isNumber = field.name.toLowerCase().includes('number') ||
                   (typeof field.defaultValue === 'number');
  return {
    type: 'input',
    props: {
      type: isNumber ? 'number' : 'text',
      defaultValue: v,
      onBlur: (e: { target: { value: string } }) => {
        const newVal = isNumber ? Number(e.target.value) : e.target.value;
        onChange(newVal as JSONValue);
      },
      style: { fontSize: 12, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 3, width: '100%' },
    },
  };
};

/* ------------------------------------------------------------------ *
 *  TextArea — multi-line text                                          *
 * ------------------------------------------------------------------ */

const TextArea: SetterComponent = ({ value, onChange }) => {
  const v = value === null || value === undefined ? '' : String(value);
  return {
    type: 'textarea',
    props: {
      defaultValue: v,
      rows: 3,
      onBlur: (e: { target: { value: string } }) => onChange(e.target.value),
      style: { fontSize: 12, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 3, width: '100%', resize: 'vertical' },
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Number — number input                                               *
 * ------------------------------------------------------------------ */

const NumberSetter: SetterComponent = ({ value, onChange, field }) => {
  const v = typeof value === 'number' ? value : 0;
  return {
    type: 'input',
    props: {
      type: 'number',
      defaultValue: v,
      min: field.extraProps?.min,
      max: field.extraProps?.max,
      step: field.extraProps?.step,
      onBlur: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
      style: { fontSize: 12, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 3, width: 100 },
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Switch — on/off                                                     *
 * ------------------------------------------------------------------ */

const Switch: SetterComponent = ({ value, onChange }) => {
  const isOn = value === true;
  return {
    type: 'button',
    props: {
      onClick: () => onChange(!isOn),
      'data-on': isOn,
      style: {
        padding: '2px 12px',
        fontSize: 11,
        background: isOn ? '#3b82f6' : '#cbd5e1',
        color: isOn ? 'white' : '#475569',
        border: 'none',
        borderRadius: 12,
        cursor: 'pointer',
      },
    },
    children: [isOn ? 'ON' : 'OFF'],
  };
};

/* ------------------------------------------------------------------ *
 *  Select — dropdown from `field.extraProps.options`                    *
 * ------------------------------------------------------------------ */

const Select: SetterComponent = ({ value, onChange, field }) => {
  const options: Array<{ label: string; value: JSONValue }> =
    (field.extraProps?.options as Array<{ label: string; value: JSONValue }>) ?? [];
  return {
    type: 'select',
    props: {
      defaultValue: String(value),
      onChange: (e: { target: { value: string } }) => {
        const opt = options.find((o) => String(o.value) === e.target.value);
        onChange(opt ? opt.value : e.target.value);
      },
      style: { fontSize: 12, padding: '2px 6px', border: '1px solid #cbd5e1', borderRadius: 3, width: '100%' },
    },
    children: options.map((o) => ({
      type: 'option',
      props: { value: String(o.value) },
      children: [o.label],
    })),
  };
};

/* ------------------------------------------------------------------ *
 *  ColorPicker — color input                                           *
 * ------------------------------------------------------------------ */

const ColorPicker: SetterComponent = ({ value, onChange }) => {
  const v = typeof value === 'string' ? value : '#000000';
  return {
    type: 'input',
    props: {
      type: 'color',
      defaultValue: v,
      onBlur: (e: { target: { value: string } }) => onChange(e.target.value),
      style: { width: 36, height: 24, border: '1px solid #cbd5e1', borderRadius: 3, padding: 0 },
    },
  };
};

/* ------------------------------------------------------------------ *
 *  Slider — range input                                                 *
 * ------------------------------------------------------------------ */

const Slider: SetterComponent = ({ value, onChange, field }) => {
  const v = typeof value === 'number' ? value : 0;
  return {
    type: 'div',
    props: { style: { display: 'flex', alignItems: 'center', gap: 8 } },
    children: [
      {
        type: 'input',
        props: {
          type: 'range',
          defaultValue: v,
          min: field.extraProps?.min ?? 0,
          max: field.extraProps?.max ?? 100,
          step: field.extraProps?.step ?? 1,
          onBlur: (e: { target: { value: string } }) => onChange(Number(e.target.value)),
          style: { flex: 1 },
        },
      },
      {
        type: 'span',
        props: { style: { fontSize: 11, color: '#475569', minWidth: 30, textAlign: 'right' } },
        children: [String(v)],
      },
    ],
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

export { Input, TextArea, NumberSetter as Number, Switch, Select, ColorPicker, Slider };
