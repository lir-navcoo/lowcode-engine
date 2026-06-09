/**
 * @monbolc/lowcode-designer — isSimulatorRenderer + SimulatorContext tests
 * Ali-mirror Phase D.I2.
 *
 * Validates the slim port of the simulator renderer type guard and the
 * React `SimulatorContext` default value.
 */
import { describe, it, expect } from 'vitest';
import { isSimulatorRenderer } from '../../src/builtin-simulator/renderer';
import { SimulatorContext } from '../../src/builtin-simulator/context';

describe('isSimulatorRenderer (Phase D.I2)', () => {
  it('returns true for an object with the discriminator flag', () => {
    expect(isSimulatorRenderer({ isSimulatorRenderer: true })).toBe(true);
  });

  it('returns false for an object without the flag', () => {
    expect(isSimulatorRenderer({})).toBe(false);
    expect(isSimulatorRenderer({ isSimulatorRenderer: false })).toBe(false);
  });

  it('returns false for null / undefined / primitives (no throw)', () => {
    expect(isSimulatorRenderer(null)).toBe(false);
    expect(isSimulatorRenderer(undefined)).toBe(false);
    expect(isSimulatorRenderer(42)).toBe(false);
    expect(isSimulatorRenderer('str')).toBe(false);
  });
});

describe('SimulatorContext (Phase D.I2)', () => {
  it('exports a React context with a Provider + Consumer', () => {
    expect(SimulatorContext).toBeDefined();
    expect(typeof SimulatorContext.Provider).toBe('object');
    expect(typeof SimulatorContext.Consumer).toBe('object');
  });

  it('default value is an empty object (slim fallback when no Provider)', () => {
    // The default `{}` is what consumers see if no Provider is mounted.
    // The default is ali-faithful (sapu's `{} as BuiltinSimulatorHost`).
    const consumer = (SimulatorContext as { _currentValue?: unknown })._currentValue;
    expect(consumer).toEqual({});
  });
});
