/**
 * @monbolc/lowcode-utils — logger interface
 *
 * The engine uses a structured logger (level + tag + structured fields).
 * Concrete implementations can be plugged in (console, sentry, file).
 * Default impl writes to console.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

export interface Logger {
  debug(msg: string, fields?: Record<string, unknown>): void;
  info(msg: string, fields?: Record<string, unknown>): void;
  warn(msg: string, fields?: Record<string, unknown>): void;
  error(msg: string, fields?: Record<string, unknown>): void;
  /** Returns a child logger with a fixed `tag` and inherited fields. */
  child(tag: string, fields?: Record<string, unknown>): Logger;
  /** Runtime level filter. 'silent' suppresses everything. */
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
}

const LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
  silent: 100,
};

const LEVEL_METHOD: Record<'debug' | 'info' | 'warn' | 'error', string> = {
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

export interface ConsoleLoggerOptions {
  level?: LogLevel;
  /** Prefix all messages (typically the package name, e.g. "@monbolc/lowcode-engine"). */
  prefix?: string;
}

/**
 * Console-based logger. Honors the runtime level filter.
 */
export class ConsoleLogger implements Logger {
  private level: LogLevel;
  private readonly prefix: string;

  constructor(options: ConsoleLoggerOptions = {}) {
    this.level = options.level ?? 'info';
    this.prefix = options.prefix ?? '';
  }

  child(tag: string, fields?: Record<string, unknown>): Logger {
    const childTag = this.prefix ? `${this.prefix}:${tag}` : tag;
    const child = new ConsoleLogger({ level: this.level, prefix: childTag });
    // Wrap to attach default fields.
    if (fields) {
      return new PrefixedLogger(child, fields);
    }
    return child;
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  getLevel(): LogLevel {
    return this.level;
  }

  debug(msg: string, fields?: Record<string, unknown>): void {
    this.log('debug', msg, fields);
  }
  info(msg: string, fields?: Record<string, unknown>): void {
    this.log('info', msg, fields);
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.log('warn', msg, fields);
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.log('error', msg, fields);
  }

  private log(level: 'debug' | 'info' | 'warn' | 'error', msg: string, fields?: Record<string, unknown>): void {
    if (LEVEL_RANK[level] < LEVEL_RANK[this.level]) return;
    const tag = this.prefix ? `[${this.prefix}]` : '';
    const text = `${tag} ${msg}`.trim();
    const fn = console[LEVEL_METHOD[level] as 'debug'] ?? console.log;
    // Always pass `fields` as the second arg (undefined if not set) so
    // consumers can rely on a stable two-arg signature.
    if (fields && Object.keys(fields).length > 0) {
      (fn as (msg: string, ...args: unknown[]) => void)(text, fields);
    } else {
      (fn as (msg: string, ...args: unknown[]) => void)(text, undefined);
    }
  }
}

/** Internal helper: prepends default fields to every log call. */
class PrefixedLogger implements Logger {
  constructor(
    private readonly inner: Logger,
    private readonly defaults: Record<string, unknown>,
  ) {}

  child(tag: string, fields?: Record<string, unknown>): Logger {
    return this.inner.child(tag, { ...this.defaults, ...fields });
  }
  setLevel(level: LogLevel): void {
    this.inner.setLevel(level);
  }
  getLevel(): LogLevel {
    return this.inner.getLevel();
  }
  debug(msg: string, fields?: Record<string, unknown>): void {
    this.inner.debug(msg, { ...this.defaults, ...fields });
  }
  info(msg: string, fields?: Record<string, unknown>): void {
    this.inner.info(msg, { ...this.defaults, ...fields });
  }
  warn(msg: string, fields?: Record<string, unknown>): void {
    this.inner.warn(msg, { ...this.defaults, ...fields });
  }
  error(msg: string, fields?: Record<string, unknown>): void {
    this.inner.error(msg, { ...this.defaults, ...fields });
  }
}

/** Global logger singleton (lazily created). */
let _global: Logger | undefined;
export function getLogger(): Logger {
  if (!_global) _global = new ConsoleLogger({ level: 'info' });
  return _global;
}

export function setLogger(logger: Logger): void {
  _global = logger;
}
