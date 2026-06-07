/**
 * @monbolc/lowcode-utils — barrel export
 *
 * SapuLowcodeEngine pure-utility layer (L1). No React, no DOM, no engine state.
 * Anything that needs to be JSON-serializable lives here.
 */

// --- utility types ---
export type {
  Nil,
  Primitive,
  PlainObject,
  DeepReadonly,
  DeepPartial,
  NonEmptyArray,
  ValueOf,
} from './types';

// --- id generation ---
export { uid, seqId, resetSeqCounter } from './id';

// --- object utilities ---
export {
  isPlainObject,
  isNil,
  deepClone,
  isEqual,
  merge,
  pick,
  omit,
} from './object';

// --- path utilities ---
export { parsePath, getByPath, setByPath, deleteByPath } from './path';

// --- event bus ---
export { Emitter } from './emitter';
export type { EventHandler, EventMap } from './emitter';

// --- logger ---
export { ConsoleLogger, getLogger, setLogger } from './logger';
export type { Logger, LogLevel, ConsoleLoggerOptions } from './logger';

// --- type guards (depend on @monbolc/lowcode-types) ---
export {
  isJSONValue,
  isNodeSchema,
  isRootSchema,
  isNodeData,
  isComponentSchema,
  isFieldConfig,
  isEventConfig,
  isActionContent,
  isDataSource,
} from './guards';
