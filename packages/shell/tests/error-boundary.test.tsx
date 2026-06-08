/**
 * @monbolc/lowcode-shell — SapuErrorBoundary unit tests
 *
 * Covers the two P-task acceptance tests from
 * /Users/lirui/.claude/plans/radiant-wiggling-pizza.md (L6.6):
 *   1. A throwing child triggers the boundary fallback
 *   2. The thrown error (with engine prop) fires `pluginError`
 *
 * Uses React 19 + happy-dom (declared in the root vitest.config.ts).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

import { SapuEngine } from '../src/sapu-engine';
import { SapuErrorBoundary, DefaultErrorFallback } from '../src/error-boundary';

describe('SapuErrorBoundary (L6.6)', () => {
  beforeEach(() => {
    // happy-dom sometimes carries state across tests.
    vi.restoreAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <SapuErrorBoundary>
        <div data-testid="ok-child">hello</div>
      </SapuErrorBoundary>,
    );
    expect(screen.getByTestId('ok-child')).toBeInTheDocument();
  });

  it('renders the fallback when a child throws', () => {
    // Suppress the React 19 error log for the expected throw.
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bomb(): never {
      throw new Error('boom from child');
    }
    render(
      <SapuErrorBoundary>
        <Bomb />
      </SapuErrorBoundary>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(/boom from child/);
    consoleErr.mockRestore();
  });

  it('uses the custom fallback when provided', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Bomb(): never { throw new Error('ignored'); }
    render(
      <SapuErrorBoundary fallback={<div data-testid="custom-fallback">custom</div>}>
        <Bomb />
      </SapuErrorBoundary>,
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    consoleErr.mockRestore();
  });

  it('fires pluginError on the engine when one is provided', () => {
    const consoleErr = vi.spyOn(console, 'error').mockImplementation(() => {});
    const engine = new SapuEngine();
    engine.mount({ schema: { componentName: 'Page' }, components: {} });
    const errorListener = vi.fn();
    engine.events.on('pluginError', errorListener);

    function Bomb(): never { throw new Error('from bomb'); }
    render(
      <SapuErrorBoundary engine={engine}>
        <Bomb />
      </SapuErrorBoundary>,
    );

    expect(errorListener).toHaveBeenCalledTimes(1);
    const payload = errorListener.mock.calls[0][0];
    expect(payload.name).toBe('SapuErrorBoundary');
    expect(payload.error).toBeInstanceOf(Error);
    expect((payload.error as Error).message).toBe('from bomb');
    consoleErr.mockRestore();
  });

  it('DefaultErrorFallback renders the error message', () => {
    const err = new Error('explicit message');
    render(<DefaultErrorFallback error={err} />);
    expect(screen.getByRole('alert')).toHaveTextContent('explicit message');
  });
});
