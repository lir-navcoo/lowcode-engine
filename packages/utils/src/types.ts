/**
 * @monbolc/lowcode-utils — utility types
 *
 * Generic helper types. Kept separate from runtime code so consumers can
 * `import type` without pulling in the runtime helpers.
 */

export type Nil = null | undefined;

export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

export type PlainObject = Record<string, unknown>;

export type DeepReadonly<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? ReadonlyArray<DeepReadonly<U>>
    : T extends object
      ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
      : T;

export type DeepPartial<T> = T extends Primitive
  ? T
  : T extends Array<infer U>
    ? Array<DeepPartial<U>>
    : T extends object
      ? { [K in keyof T]?: DeepPartial<T[K]> }
      : T;

export type NonEmptyArray<T> = [T, ...T[]];

export type ValueOf<T> = T[keyof T];
