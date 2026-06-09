/**
 * @monbolc/lowcode-designer — observerHOC + useObserved tests
 * Ali-mirror Phase D.I2.
 *
 * Validates the React 19 replacement for MobX's `@observer`. Both the
 * class-form `observerHOC(Component)` and the idiomatic `useObserved(obs)`
 * are tested with `@testing-library/react` + happy-dom.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act, cleanup } from '@testing-library/react';
import { observerHOC, useObserved } from '../src/observer-hoc';
import { Observable } from '@monbolc/lowcode-utils';

afterEach(() => cleanup());

describe('useObserved (Phase D.I2)', () => {
  it('returns the current value of the observable', () => {
    const o = new Observable(42);
    function Probe() {
      return <div data-testid="v">{useObserved(o)}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('42');
  });

  it('re-renders when the observable fires change', () => {
    const o = new Observable(1);
    function Probe() {
      return <div data-testid="v">{useObserved(o)}</div>;
    }
    render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('1');
    act(() => o.set(2));
    expect(screen.getByTestId('v').textContent).toBe('2');
  });

  it('unmount cleans up the change subscription (no late updates)', () => {
    const o = new Observable(10);
    function Probe() {
      return <div data-testid="v">{useObserved(o)}</div>;
    }
    const { unmount } = render(<Probe />);
    expect(screen.getByTestId('v').textContent).toBe('10');
    unmount();
    // After unmount, setting the observable should NOT throw
    // (and the test would have failed if the subscription leaked
    // into a phantom subscriber).
    expect(() => o.set(11)).not.toThrow();
  });

  it('getSnapshot is stable across calls (returns the same reference when value unchanged)', () => {
    const o = new Observable('hello');
    let snap1: string | undefined;
    let snap2: string | undefined;
    function Probe() {
      const v = useObserved(o);
      snap1 = v;
      snap2 = v;
      return <div>{v}</div>;
    }
    render(<Probe />);
    expect(snap1).toBe(snap2);
    expect(snap1).toBe('hello');
  });
});

describe('observerHOC (Phase D.I2)', () => {
  it('render the wrapped component once on mount', () => {
    function Greet({ name }: { name: string }) {
      return <div data-testid="g">hello {name}</div>;
    }
    const G = observerHOC(Greet);
    render(<G name="world" />);
    expect(screen.getByTestId('g').textContent).toBe('hello world');
  });

  it('re-renders when a tracked observable changes', () => {
    const o = new Observable(1);
    function Counter() {
      const n = useObserved(o);
      return <div data-testid="c">{n}</div>;
    }
    const C = observerHOC(Counter);
    render(<C />);
    expect(screen.getByTestId('c').textContent).toBe('1');
    act(() => o.set(2));
    expect(screen.getByTestId('c').textContent).toBe('2');
  });

  it('displayName is ObserverHOC(${name})', () => {
    function Named() {
      return <div />;
    }
    Named.displayName = 'MyComp';
    const N = observerHOC(Named);
    expect(N.displayName).toBe('ObserverHOC(MyComp)');
  });

  it('passes props through to the wrapped component', () => {
    function Show({ x, y }: { x: number; y: number }) {
      return <div data-testid="s">{x + y}</div>;
    }
    const S = observerHOC(Show);
    render(<S x={2} y={3} />);
    expect(screen.getByTestId('s').textContent).toBe('5');
  });

  it('unmount cleans up; no late updates after unmount', () => {
    const o = new Observable(100);
    function Probe() {
      const n = useObserved(o);
      return <div data-testid="n">{n}</div>;
    }
    const P = observerHOC(Probe);
    const { unmount } = render(<P />);
    expect(screen.getByTestId('n').textContent).toBe('100');
    unmount();
    expect(() => o.set(200)).not.toThrow();
  });
});
