/**
 * @monbolc/lowcode-plugin-setters — built-in setter tests
 *
 * The setters are pure data: each returns a `SetterDescriptor` (no
 * React, no createElement). These tests check:
 *   1. The descriptor shape — `type` is a known BaseUI / HTML name.
 *   2. The `className` prop contains Tailwind v4 utility classes
 *      (so the consumer can verify styling works).
 *   3. The value/onChange/field wiring is right (number vs text,
 *      onBlur reads target value, etc).
 *
 * No DOM is required — that's the whole point of the descriptor
 * approach. The L4 settings panel is the only place that
 * instantiates BaseUI components.
 */
import { describe, it, expect } from 'vitest';

import {
  Input,
  TextArea,
  Number,
  Switch,
  Select,
  ColorPicker,
  Slider,
} from '../src/built-in';
import type { SetterDescriptor, SetterProps } from '../src/registry';

const baseField = {
  name: 'foo',
  path: ['foo'],
  type: 'string',
} as unknown as SetterProps['field'];

const propsFor = (value: unknown, field = baseField): SetterProps => ({
  value: value as never,
  field,
  onChange: () => undefined,
});

describe('Input setter (BaseUI.Input)', () => {
  it('returns a descriptor with type "Input"', () => {
    const d = Input(propsFor('hello'));
    expect(d.type).toBe('Input');
  });

  it('includes Tailwind utility classes in className', () => {
    const d = Input(propsFor('hello'));
    const cls = String(d.props?.className ?? '');
    expect(cls).toContain('w-full');
    expect(cls).toContain('px-2');
    expect(cls).toContain('border-slate-300');
  });

  it('uses type="text" by default and type="number" for number fields', () => {
    const text = Input(propsFor('hello'));
    expect(text.props?.type).toBe('text');
    const numField = { ...baseField, name: 'portNumber' } as unknown as SetterProps['field'];
    const num = Input(propsFor('0', numField));
    expect(num.props?.type).toBe('number');
  });

  it('emits defaultValue as a string for text and number too', () => {
    const d = Input(propsFor(42, { ...baseField, name: 'portNumber' } as unknown as SetterProps['field']));
    expect(d.props?.defaultValue).toBe('42');
  });

  it('onBlur converts the value to a number for number fields', () => {
    const calls: unknown[] = [];
    const d = Input({
      ...propsFor(0, { ...baseField, name: 'portNumber' } as unknown as SetterProps['field']),
      onChange: (v) => calls.push(v),
    });
    const onBlur = d.props?.onBlur as (e: { target: { value: string } }) => void;
    onBlur({ target: { value: '99' } });
    expect(calls).toEqual([99]);
  });
});

describe('TextArea setter (raw <textarea>)', () => {
  it('returns a descriptor with type "textarea"', () => {
    const d = TextArea(propsFor('hi'));
    expect(d.type).toBe('textarea');
  });

  it('includes a vertical-resize utility class', () => {
    const d = TextArea(propsFor('hi'));
    const cls = String(d.props?.className ?? '');
    expect(cls).toContain('resize-y');
  });

  it('commits on blur with the raw string', () => {
    const calls: unknown[] = [];
    const d = TextArea({ ...propsFor('initial'), onChange: (v) => calls.push(v) });
    const onBlur = d.props?.onBlur as (e: { target: { value: string } }) => void;
    onBlur({ target: { value: 'new value' } });
    expect(calls).toEqual(['new value']);
  });
});

describe('Number setter (BaseUI.NumberField)', () => {
  it('returns a descriptor with type "NumberField"', () => {
    const d = Number(propsFor(5));
    expect(d.type).toBe('NumberField');
  });

  it('forwards min/max/step from field.extraProps', () => {
    const field = { ...baseField, extraProps: { min: 1, max: 10, step: 0.5 } } as unknown as SetterProps['field'];
    const d = Number(propsFor(5, field));
    expect(d.props?.min).toBe(1);
    expect(d.props?.max).toBe(10);
    expect(d.props?.step).toBe(0.5);
  });

  it('onValueChange emits the raw number', () => {
    const calls: unknown[] = [];
    const d = Number({ ...propsFor(0), onChange: (v) => calls.push(v) });
    const onValueChange = d.props?.onValueChange as (v: number | null) => void;
    onValueChange(42);
    expect(calls).toEqual([42]);
  });

  it('onValueChange null → 0 (never emits null/undefined)', () => {
    const calls: unknown[] = [];
    const d = Number({ ...propsFor(0), onChange: (v) => calls.push(v) });
    const onValueChange = d.props?.onValueChange as (v: number | null) => void;
    onValueChange(null);
    expect(calls).toEqual([0]);
  });
});

describe('Switch setter (BaseUI.Switch.Root)', () => {
  it('returns a descriptor with type "Switch"', () => {
    const d = Switch(propsFor(true));
    expect(d.type).toBe('Switch');
  });

  it('checked=true → blue background class, checked=false → slate', () => {
    const on = Switch(propsFor(true));
    const off = Switch(propsFor(false));
    expect(String(on.props?.className)).toContain('bg-blue-500');
    expect(String(off.props?.className)).toContain('bg-slate-300');
  });

  it('onCheckedChange emits the boolean', () => {
    const calls: unknown[] = [];
    const d = Switch({ ...propsFor(false), onChange: (v) => calls.push(v) });
    const onCheckedChange = d.props?.onCheckedChange as (v: boolean) => void;
    onCheckedChange(true);
    expect(calls).toEqual([true]);
  });
});

describe('Select setter (BaseUI.Select.Root)', () => {
  const optsField = {
    ...baseField,
    extraProps: {
      options: [
        { label: 'One', value: '1' },
        { label: 'Two', value: '2' },
      ],
    },
  } as unknown as SetterProps['field'];

  it('returns a descriptor with type "Select"', () => {
    const d = Select(propsFor('1', optsField));
    expect(d.type).toBe('Select');
  });

  it('renders the options as child descriptors (one per option)', () => {
    const d = Select(propsFor('1', optsField));
    expect(d.children).toHaveLength(2);
    const first = d.children?.[0] as SetterDescriptor;
    expect(first.type).toBe('option');
    expect(first.props?.value).toBe('1');
  });

  it('onValueChange resolves the string back to the option value', () => {
    const calls: unknown[] = [];
    const d = Select({ ...propsFor('1', optsField), onChange: (v) => calls.push(v) });
    const onValueChange = d.props?.onValueChange as (v: string) => void;
    onValueChange('2');
    expect(calls).toEqual(['2']);
  });

  it('falls back to the raw string when the option is not found', () => {
    const calls: unknown[] = [];
    const d = Select({ ...propsFor('1', optsField), onChange: (v) => calls.push(v) });
    const onValueChange = d.props?.onValueChange as (v: string) => void;
    onValueChange('99');
    expect(calls).toEqual(['99']);
  });
});

describe('ColorPicker setter (raw <input type="color">)', () => {
  it('returns a descriptor with type "input" and type="color"', () => {
    const d = ColorPicker(propsFor('#ff0000'));
    expect(d.type).toBe('input');
    expect(d.props?.type).toBe('color');
  });

  it('falls back to #000000 for non-string values', () => {
    const d = ColorPicker(propsFor(42));
    expect(d.props?.defaultValue).toBe('#000000');
  });

  it('commits on blur', () => {
    const calls: unknown[] = [];
    const d = ColorPicker({ ...propsFor('#000000'), onChange: (v) => calls.push(v) });
    const onBlur = d.props?.onBlur as (e: { target: { value: string } }) => void;
    onBlur({ target: { value: '#abcdef' } });
    expect(calls).toEqual(['#abcdef']);
  });
});

describe('Slider setter (BaseUI.Slider.Root)', () => {
  it('returns a descriptor with type "Slider"', () => {
    const d = Slider(propsFor(50));
    expect(d.type).toBe('Slider');
  });

  it('defaults min=0, max=100, step=1', () => {
    const d = Slider(propsFor(50));
    expect(d.props?.min).toBe(0);
    expect(d.props?.max).toBe(100);
    expect(d.props?.step).toBe(1);
  });

  it('forwards min/max/step from field.extraProps', () => {
    const field = { ...baseField, extraProps: { min: -50, max: 50, step: 5 } } as unknown as SetterProps['field'];
    const d = Slider(propsFor(0, field));
    expect(d.props?.min).toBe(-50);
    expect(d.props?.max).toBe(50);
    expect(d.props?.step).toBe(5);
  });

  it('onValueChange emits the raw number', () => {
    const calls: unknown[] = [];
    const d = Slider({ ...propsFor(0), onChange: (v) => calls.push(v) });
    const onValueChange = d.props?.onValueChange as (v: number) => void;
    onValueChange(42);
    expect(calls).toEqual([42]);
  });
});
