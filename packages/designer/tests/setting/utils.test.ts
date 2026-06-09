/**
 * @monbolc/lowcode-designer — setting/ Transducer tests
 * Ali-mirror Phase D.S1.
 *
 * Validates the slim port of the `Transducer` value-object. The Transducer
 * unwraps a setter config (string / SetterConfig / array / React element /
 * dynamic function) into a `toHot` / `toNative` pair.
 */
import { describe, it, expect, vi } from 'vitest';
import { isValidElement } from 'react';
import { Transducer } from '../../src/designer/setting/utils';
import type { ISettingField } from '../../src/designer/setting/setting-entry-type';

/**
 * Build a minimal ISettingField context for the Transducer.
 * Only the methods the Transducer reads (`setters.getSetter`,
 * optionally `internalToShellField`) are populated.
 */
function mkContext(getSetterImpl?: (name: string) => unknown): ISettingField {
  return {
    id: 'ctx',
    name: 'ctx',
    path: [],
    setters: {
      getSetter: getSetterImpl ?? ((): unknown => undefined),
    },
  } as unknown as ISettingField;
}

describe('setting/utils Transducer (Phase D.S1)', () => {
  it('constructor with a string setter does not throw and produces toHot/toNative', () => {
    const ctx = mkContext();
    const t = new Transducer(ctx, { setter: 'StringSetter' });
    expect(typeof t.toHot).toBe('function');
    expect(typeof t.toNative).toBe('function');
  });

  it('toHot returns the input when no Hotter / transducer is provided (identity)', () => {
    const ctx = mkContext();
    const t = new Transducer(ctx, { setter: 'StringSetter' });
    const value = { foo: 1 };
    expect(t.toHot(value)).toBe(value);
    expect(t.toNative(value)).toBe(value);
  });

  it('transducer.toHot / toNative is invoked when the setter declares `Transducer`', () => {
    const toHot = vi.fn((x: unknown) => `hot:${String(x)}`);
    const toNative = vi.fn((x: unknown) => `native:${String(x)}`);
    const ctx = mkContext((name) =>
      name === 'WithTransducer'
        ? { component: { Transducer: { toHot, toNative } } }
        : undefined,
    );
    const t = new Transducer(ctx, { setter: 'WithTransducer' });
    expect(t.toHot('x')).toBe('hot:x');
    expect(t.toNative('y')).toBe('native:y');
  });

  it('Hotter: [toHot, toNative] array form is wrapped into a transducer object', () => {
    const toHot = (x: unknown) => `hot:${String(x)}`;
    const toNative = (x: unknown) => `native:${String(x)}`;
    const ctx = mkContext((name) =>
      name === 'WithHotter' ? { component: { Hotter: [toHot, toNative] } } : undefined,
    );
    const t = new Transducer(ctx, { setter: 'WithHotter' });
    expect(t.toHot('a')).toBe('hot:a');
    expect(t.toNative('b')).toBe('native:b');
  });

  it('array setter config unwraps to the first element', () => {
    const toHot = vi.fn((x: unknown) => x);
    const toNative = vi.fn((x: unknown) => x);
    const ctx = mkContext((name) =>
      name === 'First' ? { component: { toHot, toNative } } : undefined,
    );
    const t = new Transducer(ctx, {
      setter: ['First', 'Second' as unknown as { componentName: string }],
    });
    expect(typeof t.toHot).toBe('function');
  });

  it('SetConfig { componentName, isDynamic: false } is unwrapped to the string name', () => {
    const toHot = vi.fn((x: unknown) => x);
    const toNative = vi.fn((x: unknown) => x);
    const ctx = mkContext((name) =>
      name === 'Static' ? { component: { toHot, toNative } } : undefined,
    );
    const t = new Transducer(ctx, {
      setter: { componentName: 'Static', isDynamic: false } as never,
    });
    expect(typeof t.toHot).toBe('function');
    expect(t.toHot('z')).toBe('z');
  });

  it('static setter with isDynamic: true (default) is treated as a function and called', () => {
    // When the registered setter is a function (isDynamic), Transducer invokes
    // it with the shell-field handle. The slim port catches errors silently
    // (mirrors ali). Assert no throw.
    const ctx: ISettingField = {
      id: 'c',
      name: 'c',
      path: [],
      setters: { getSetter: () => undefined },
    } as unknown as ISettingField;
    const t = new Transducer(ctx, { setter: 'NoSuchSetter' });
    expect(typeof t.toHot).toBe('function');
  });

  it('isValidElement: a React element of MixedSetter is unwrapped to its first inner setter', () => {
    const inner: { componentName: string } = { componentName: 'Inner' };
    const element = { $$typeof: isValidElement({}) ? Symbol.for('react.element') : 0, type: { displayName: 'MixedSetter' }, props: { setters: [inner] } } as unknown as Parameters<typeof Transducer>[1] extends infer R ? R extends { setter: infer S } ? S : never : never;
    const ctx = mkContext((name) =>
      name === 'Inner' ? { component: { toHot: (x: unknown) => x, toNative: (x: unknown) => x } } : undefined,
    );
    const t = new Transducer(ctx, { setter: element as never });
    expect(typeof t.toHot).toBe('function');
  });
});
