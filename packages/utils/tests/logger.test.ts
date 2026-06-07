import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { ConsoleLogger, getLogger, setLogger } from '../src/logger';

type Spies = {
  debug: MockInstance;
  info: MockInstance;
  warn: MockInstance;
  error: MockInstance;
  log: MockInstance;
};

describe('ConsoleLogger', () => {
  let spies: Spies;
  beforeEach(() => {
    spies = {
      debug: vi.spyOn(console, 'debug').mockImplementation(() => undefined),
      info: vi.spyOn(console, 'info').mockImplementation(() => undefined),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      error: vi.spyOn(console, 'error').mockImplementation(() => undefined),
      log: vi.spyOn(console, 'log').mockImplementation(() => undefined),
    };
  });
  afterEach(() => {
    Object.values(spies).forEach((s) => s.mockRestore());
  });

  it('level filter: debug suppressed when level=info', () => {
    const logger = new ConsoleLogger({ level: 'info' });
    logger.debug('x');
    logger.info('y');
    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).toHaveBeenCalledTimes(1);
  });

  it('level=silent suppresses everything', () => {
    const logger = new ConsoleLogger({ level: 'silent' });
    logger.debug('x');
    logger.info('y');
    logger.warn('z');
    logger.error('w');
    expect(spies.debug).not.toHaveBeenCalled();
    expect(spies.info).not.toHaveBeenCalled();
    expect(spies.warn).not.toHaveBeenCalled();
    expect(spies.error).not.toHaveBeenCalled();
  });

  it('prefix is included in messages', () => {
    const logger = new ConsoleLogger({ level: 'debug', prefix: 'pkg' });
    logger.info('hello');
    expect(spies.info).toHaveBeenCalledWith('[pkg] hello', undefined);
  });

  it('child() inherits level and tag', () => {
    const logger = new ConsoleLogger({ level: 'warn', prefix: 'parent' });
    const child = logger.child('child');
    child.warn('boom');
    expect(spies.warn).toHaveBeenCalledWith('[parent:child] boom', undefined);
  });

  it('setLevel + getLevel round-trip', () => {
    const logger = new ConsoleLogger();
    expect(logger.getLevel()).toBe('info');
    logger.setLevel('debug');
    expect(logger.getLevel()).toBe('debug');
  });
});

describe('global logger', () => {
  it('getLogger() returns a singleton by default', () => {
    const a = getLogger();
    const b = getLogger();
    expect(a).toBe(b);
  });
  it('setLogger() replaces the global', () => {
    const original = getLogger();
    const replacement = new ConsoleLogger({ level: 'error' });
    setLogger(replacement);
    expect(getLogger()).toBe(replacement);
    setLogger(original);
  });
});
