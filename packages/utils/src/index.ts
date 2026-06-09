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

// --- Phase A ali-mirror: Observable-lite ---
// Replaces ali's MobX `@obx` / `@computed` / `@autorun` /
// `reaction` decorators without pulling in MobX. Ali-faithful
// surface; the React HOC `observerHOC` lives in the designer
// package (Phase D) and subscribes to these primitives.
export { Observable, autorun, computed, reaction } from './observable-lite';
export type { ObservableEvents } from './observable-lite';

// --- Phase A ali-mirror: throttle ---
// Port of ali's `designer/src/builtin-simulator/utils/throttle.ts`.
// Ali-faithful algorithm (leading + trailing, RAF-aware); sapu
// adds a `.dispose()` method for clean teardown.
export { throttle } from './throttle';

// --- inline-SVG icon shell ---
// Pure-function React component that renders a size-typed inline
// `<svg>`. The glyph itself is left to a downstream icon-pack
// package; `SapuIcon` only decides the size / fill / viewBox shell.
// Ali-faithful contract on size presets and `fill` → `style.color`
// merging; no Fusion / runtime 类型校验 / class components.
export { SapuIcon } from './icon';
export type { SapuIconProps } from './icon';
