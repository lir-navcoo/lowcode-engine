/**
 * @monbolc/lowcode-plugin-setters — registry tests
 *
 * Tests for the setter registry: register / get / pick /
 * resolveSetterName / withLabel. The 7 setter implementations are
 * tested in `built-in.test.ts`; this file covers the
 * plumbing.
 */
import { describe, it, expect, beforeEach } from 'vitest';

import {
  registerSetter,
  unregisterSetter,
  hasSetter,
  getSetter,
  pickSetter,
  resolveSetterName,
  withLabel,
  BUILT_IN_SETTERS,
  registerBuiltInSetters,
} from '../src/index';
import type { SetterComponent, SetterDescriptor } from '../src/registry';

beforeEach(() => {
  registerBuiltInSetters();
});

describe('registerSetter / getSetter', () => {
  it('registers and retrieves a custom setter', () => {
    const custom: SetterComponent = () => ({ type: 'input', props: { className: 'x' } });
    registerSetter('MyCustom', custom);
    expect(getSetter('MyCustom')).toBe(custom);
  });

  it('returns undefined for an unregistered name', () => {
    expect(getSetter('DoesNotExist')).toBeUndefined();
  });

  it('hasSetter: true after register, false after unregister (D.I7b.16)', () => {
    const custom: SetterComponent = () => ({ type: 'input', props: { className: 'x' } });
    expect(hasSetter('MyToggle')).toBe(false);
    registerSetter('MyToggle', custom);
    expect(hasSetter('MyToggle')).toBe(true);
    unregisterSetter('MyToggle');
    expect(hasSetter('MyToggle')).toBe(false);
    expect(getSetter('MyToggle')).toBeUndefined();
  });

  it('unregisterSetter: returns true on first call (entry removed), false on second (no-op) (D.I7b.16)', () => {
    const custom: SetterComponent = () => ({ type: 'input', props: { className: 'x' } });
    registerSetter('MyDisposable', custom);
    expect(unregisterSetter('MyDisposable')).toBe(true);
    // Second call: name not present anymore, no-op.
    expect(unregisterSetter('MyDisposable')).toBe(false);
  });

  it('unregisterSetter of an unknown name is a no-op (D.I7b.16)', () => {
    expect(unregisterSetter('NeverRegistered')).toBe(false);
    expect(hasSetter('NeverRegistered')).toBe(false);
  });

  it('after unregister, pickSetter falls back to the inferred default (D.I7b.16)', () => {
    const custom: SetterComponent = () => ({ type: 'input', props: { className: 'x' } });
    registerSetter('MyCustom', custom);
    const f = { name: 'foo', setter: 'MyCustom' } as never;
    expect(pickSetter(f)).toBe(custom);
    unregisterSetter('MyCustom');
    // Falls back to Input (the default).
    expect(pickSetter(f)).toBe(getSetter('Input'));
  });
});

describe('pickSetter', () => {
  const fieldWith = (setter: unknown) =>
    ({ name: 'x', path: ['x'], type: 'string', setter } as never);

  it('picks the named setter (string form)', () => {
    const f = fieldWith('Switch');
    expect(pickSetter(f)).toBe(getSetter('Switch'));
  });

  it('picks the named setter (IPublicTypeSetterConfig form)', () => {
    const f = fieldWith({ componentName: 'Select' });
    expect(pickSetter(f)).toBe(getSetter('Select'));
  });

  it('falls back to "Input" when the field has no setter', () => {
    const f = fieldWith(undefined);
    expect(pickSetter(f)).toBe(getSetter('Input'));
  });

  it('falls back to "Input" when the named setter is not registered', () => {
    const f = fieldWith('NonExistent');
    expect(pickSetter(f)).toBe(getSetter('Input'));
  });
});

describe('resolveSetterName', () => {
  it('returns the string when given a string', () => {
    expect(resolveSetterName('Switch')).toBe('Switch');
  });

  it('returns componentName when given a config object', () => {
    expect(resolveSetterName({ componentName: 'Slider' })).toBe('Slider');
  });

  it('returns "Input" when given undefined', () => {
    expect(resolveSetterName(undefined)).toBe('Input');
  });
});

describe('withLabel', () => {
  it('returns a div descriptor with a label + control child', () => {
    const control: SetterDescriptor = { type: 'input', props: { className: 'cls' } };
    const d = withLabel('My Label', control);
    expect(d.type).toBe('div');
    expect(d.children).toHaveLength(2);
    const label = d.children?.[0] as SetterDescriptor;
    const ctrl = d.children?.[1] as SetterDescriptor;
    expect(label.type).toBe('label');
    expect(label.children?.[0]).toBe('My Label');
    expect(ctrl).toBe(control);
  });

  it('label child has a Tailwind text utility class', () => {
    const d = withLabel('X', { type: 'input' });
    const label = d.children?.[0] as SetterDescriptor;
    const cls = String(label.props?.className ?? '');
    expect(cls).toContain('text-');
    expect(cls).toContain('text-slate-');
  });
});

describe('BUILT_IN_SETTERS constant', () => {
  it('lists the 7 built-in setter names', () => {
    expect(BUILT_IN_SETTERS).toEqual([
      'Input',
      'TextArea',
      'Number',
      'Switch',
      'Select',
      'ColorPicker',
      'Slider',
    ]);
  });
});

describe('registerBuiltInSetters', () => {
  it('registers all 7 built-in setters', () => {
    for (const name of BUILT_IN_SETTERS) {
      expect(getSetter(name)).toBeDefined();
    }
  });

  it('is idempotent', () => {
    registerBuiltInSetters();
    registerBuiltInSetters();
    // The Switch setter reference is still the one from built-in.tsx.
    expect(getSetter('Switch')).toBe(getSetter('Switch'));
  });
});
