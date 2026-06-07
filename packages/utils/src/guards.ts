/**
 * @monbolc/lowcode-utils — type guards for SapuLowcodeEngine schemas
 *
 * Runtime checks that narrow `unknown` into the engine's typed shapes.
 * Every guard is a pure function with no side effects, so it can be tree-shaken.
 */

import type {
  IPublicTypeNodeSchema,
  IPublicTypeNodeData,
  IPublicTypeComponentSchema,
  IPublicTypeRootSchema,
  IPublicTypeFieldConfig,
  IPublicTypeEventConfig,
  IPublicTypeActionContent,
  IPublicTypeDataSource,
  JSONValue,
} from '@monbolc/lowcode-types';

import { isPlainObject } from './object';

/** True if `value` is a JSON-compatible primitive, array, or object. */
export function isJSONValue(value: unknown): value is JSONValue {
  if (value === null) return true;
  const t = typeof value;
  if (t === 'string' || t === 'number' || t === 'boolean') return true;
  if (Array.isArray(value)) return value.every(isJSONValue);
  if (isPlainObject(value)) {
    for (const key of Object.keys(value)) {
      if (!isJSONValue((value as Record<string, unknown>)[key])) return false;
    }
    return true;
  }
  return false;
}

/** True if `value` looks like a node schema. */
export function isNodeSchema(value: unknown): value is IPublicTypeNodeSchema {
  return (
    isPlainObject(value) &&
    typeof (value as unknown as Record<string, unknown>).componentName === 'string'
  );
}

/** True if `value` looks like a root schema (a node plus a `fileName`). */
export function isRootSchema(value: unknown): value is IPublicTypeRootSchema {
  return (
    isNodeSchema(value) &&
    typeof (value as unknown as Record<string, unknown>).fileName === 'string'
  );
}

/** True if `value` is one of the three node-data variants. */
export function isNodeData(value: unknown): value is IPublicTypeNodeData {
  if (!isPlainObject(value)) return false;
  const type = (value as Record<string, unknown>).type;
  return type === 'literal' || type === 'expression' || type === 'binding';
}

/** True if `value` looks like a component meta. */
export function isComponentSchema(value: unknown): value is IPublicTypeComponentSchema {
  if (!isPlainObject(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.componentName === 'string' && typeof v.title === 'string';
}

/** True if `value` looks like a setter field config. */
export function isFieldConfig(value: unknown): value is IPublicTypeFieldConfig {
  if (!isPlainObject(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.title === 'string' && v.setter !== undefined;
}

/** True if `value` looks like an event config. */
export function isEventConfig(value: unknown): value is IPublicTypeEventConfig {
  if (!isPlainObject(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.name === 'string' && typeof v.title === 'string';
}

/** True if `value` is one of the three action content variants. */
export function isActionContent(value: unknown): value is IPublicTypeActionContent {
  if (!isPlainObject(value)) return false;
  const type = (value as Record<string, unknown>).type;
  return type === 'method' || type === 'link' || type === 'script';
}

/** True if `value` looks like a data source entry. */
export function isDataSource(value: unknown): value is IPublicTypeDataSource {
  if (!isPlainObject(value)) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.handler === 'string';
}
