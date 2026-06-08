/**
 * @monbolc/lowcode-designer — parse-metadata (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/utils/parse-metadata.ts`.
 * Two runtime metadata parsers ali uses to read a React component's
 * `propTypes` + `defaultProps` into sapu's `IPublicTypePropConfig[]`.
 *
 * **Phase B scope (drop `prop-types`)**:
 * The ali file uses `prop-types` + `react.isValidElement` +
 * `window.PropTypes` global mutation. Sapu's setter system is
 * ali-faithful on its own (see `@monbolc/lowcode-plugin-setters`).
 * We DROP the `LowcodeTypes` wrapper and the `prop-types`
 * import — Phase D's setter re-implementation will use sapu's
 * own `propType` annotation scheme. What we KEEP here is the
 * runtime parsing shape (`parseProps` + `parseMetadata` + the
 * `primitiveTypes` list) so a setter can call `parseProps`
 * against a component class and get the same shape ali does.
 *
 * The `lowcodeType` annotation on a propType is what ali
 * writes when you do `PropTypes.string` (or any of the
 * `LowcodeTypes.define(...)` wrappers). We honor that
 * annotation here without depending on the prop-types lib.
 */
/**
 * Slim in-file interface for the prop entry shape. Ali uses
 * `IPublicTypePropConfig` from `@alilc/lowcode-types`; sapu's
 * `@monbolc/lowcode-types` doesn't ship that interface yet.
 * When it does (Phase D's setting tree port), swap to the
 * ali-faithful import.
 */
export interface PropConfig {
  name: string;
  propType: unknown;
  defaultValue?: unknown;
}

export const primitiveTypes = [
  'string',
  'number',
  'array',
  'bool',
  'func',
  'object',
  'node',
  'element',
  'symbol',
  'any',
] as const;

const BasicTypes = ['string', 'number', 'object'];

/**
 * Ali-faithful. Walk the component's `propTypes` and
 * `defaultProps` and produce an `IPublicTypePropConfig[]`.
 *
 * Each entry has shape `{ name, propType, defaultValue? }`. The
 * `propType` is either the `lowcodeType` annotation ali
 * attaches (e.g. `'string' | 'oneOf' | 'arrayOf' | ...`) or one
 * of the 10 `primitiveTypes` ali-faithful values.
 *
 * `parseProps` does NOT call into `prop-types`; it reads the
 * `lowcodeType` field ali's setter writes when you do
 * `LowcodeTypes.string` (etc.). The Phase B scope is the parser
 * surface, not the writer.
 */
export function parseProps(component: unknown): PropConfig[] {
  if (!component) return [];
  const c = component as {
    propTypes?: Record<string, { lowcodeType?: string | object }>;
    defaultProps?: Record<string, unknown>;
  };
  const propTypes = c.propTypes ?? {};
  const defaultProps = c.defaultProps ?? {};
  const result: Record<string, PropConfig> = {};
  if (!propTypes) return [];

  Object.keys(propTypes).forEach((key) => {
    const propTypeItem = propTypes[key];
    const defaultValue = defaultProps[key];
    const lt = propTypeItem?.lowcodeType;
    if (lt !== undefined) {
      result[key] = { name: key, propType: lt };
      if (defaultValue != null) result[key]!.defaultValue = defaultValue as never;
      return;
    }
    // Without an explicit `lowcodeType` annotation, infer from
    // a `propTypeItem === PropTypes.XYZ` reference. We don't
    // have access to the PropTypes singletons here (we dropped
    // the dep), so we look for a string tag in the object's
    // `name` field as a best-effort fallback.
    let i = primitiveTypes.length;
    let matched: string | undefined;
    while (i-- > 0) {
      const k = primitiveTypes[i];
      // Best-effort: if the propTypeItem is the literal
      // `LowcodeTypes.string`-style object ali creates, its
      // `lowcodeType` is set (caught above). For an
      // unannotated propType, fall through to `'any'`.
      if (k === (propTypeItem as { lowcodeType?: string }).lowcodeType) {
        matched = k;
        break;
      }
    }
    result[key] = { name: key, propType: (matched ?? 'any') as never };
    if (defaultValue != null) result[key]!.defaultValue = defaultValue as never;
  });

  // For defaultProps not present in propTypes, infer the
  // primitive type from the default value's JS typeof.
  Object.keys(defaultProps).forEach((key) => {
    if (result[key]) return;
    const defaultValue = defaultProps[key];
    let t: string = typeof defaultValue;
    if (t === 'boolean') t = 'bool';
    else if (t === 'function') t = 'func';
    else if (t === 'object' && Array.isArray(defaultValue)) t = 'array';
    else if (defaultValue && isReactElementLike(defaultValue)) t = 'node';
    else if (defaultValue && isDomElementLike(defaultValue)) t = 'element';
    else if (!BasicTypes.includes(t)) t = 'any';
    result[key] = { name: key, propType: (t || 'any') as never, defaultValue: defaultValue as never };
  });

  return Object.keys(result).map((k) => result[k]!);
}

/**
 * Ali-faithful. Top-level metadata shape: `{ props, ...componentMetadata }`.
 * The `...componentMetadata` spread is the ali-faithful "let the
 * component override" — `component.componentMetadata` is the
 * `IPublicTypeComponentMetadata` ali exposes.
 */
export function parseMetadata(component: unknown): {
  props: PropConfig[];
  [key: string]: unknown;
} {
  const c = component as {
    componentMetadata?: Record<string, unknown>;
  };
  return {
    props: parseProps(component),
    ...(c.componentMetadata ?? {}),
  };
}

// ---------------------------------------------------------------------------
// Element detection shims (replace ali's react.isValidElement + isElement)
// ---------------------------------------------------------------------------
//
// Ali imports `isElement` from `@alilc/lowcode-utils` and
// `isValidElement` from `react`. Both are used in `parseProps`
// only to type-infer the defaultValue of an unannotated prop.
// We don't want a `react` dep in the slim designer (Phase A's
// stance: keep React out of the L3 / L4 logic). Use a duck-type
// check that is good enough for prop-type inference.

function isReactElementLike(v: unknown): boolean {
  return !!v && typeof v === 'object' && '$$typeof' in (v as object);
}

function isDomElementLike(v: unknown): boolean {
  return !!v && typeof v === 'object' && 'nodeType' in (v as object) && 'tagName' in (v as object);
}
