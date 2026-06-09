/**
 * @monbolc/lowcode-designer — setting/utils
 * Ali-mirror Phase D.S1: the `Transducer` value-object + 3 private helpers.
 *
 * Slim port of `alibaba/lowcode-engine/packages/designer/src/designer/setting/utils.ts`.
 * The Transducer unwraps a setter config (which can be a string, a
 * SetterConfig object, an array, a React element, or a dynamic function)
 * down to a `setter` value, then combines the setter's `transducer` and
 * `Hotter` declarations into a `toHot` / `toNative` pair.
 *
 * It is a pure value-object: no mobx, no React hooks, no state mutations
 * after construction. Tests can assert on identity (no Hotter/Transducer
 * → toHot(x) === x) or on shape (the combined transducer's bound context).
 *
 * Ali imports replaced (slim sources):
 *   - `@alilc/lowcode-utils.isSetterConfig`  → local 1-line type guard
 *   - `@alilc/lowcode-utils.isDynamicSetter` → local 1-line type guard
 *   - `./setting-field.ISettingField`         → `./setting-entry-type.ISettingField`
 *   - `@alilc/lowcode-types.IPublicTypeFieldConfig` / `IPublicTypeSetterConfig`
 *     → `@monbolc/lowcode-types` (same shape, already shipped in sapu)
 */
import { isValidElement } from 'react';
import type { IPublicTypeFieldConfig, IPublicTypeSetterConfig } from '@monbolc/lowcode-types';
import type { ISettingField } from './setting-entry-type';

/**
 * Local slim re-implementation of `@alilc/lowcode-utils.isSetterConfig`.
 * Ali checks: `x.componentName` is a string and `x.isDynamic` is a boolean.
 * The slim port keeps just the `componentName` discriminator — `isDynamic`
 * is a flag the caller can read off the result.
 */
function isSetterConfig(x: unknown): x is IPublicTypeSetterConfig {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as { componentName?: unknown }).componentName === 'string'
  );
}

/**
 * Local slim re-implementation of `@alilc/lowcode-utils.isDynamicSetter`.
 * Ali uses lodash's `isFunction`; sapu uses native `typeof === 'function'`.
 */
function isDynamicSetter(x: unknown): x is (...args: unknown[]) => unknown {
  return typeof x === 'function';
}

function getHotterFromSetter(setter: unknown): Array<unknown> {
  const s = setter as { Hotter?: Array<unknown>; type?: { Hotter?: Array<unknown> } } | null;
  return (s && (s.Hotter || (s.type && s.type.Hotter))) || [];
}

function getTransducerFromSetter(
  setter: unknown,
): { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown } | null {
  const s = setter as {
    transducer?: { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown };
    Transducer?: { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown };
    type?: {
      transducer?: { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown };
      Transducer?: { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown };
    };
  } | null;
  return (
    (s &&
      (s.transducer ||
        s.Transducer ||
        (s.type && (s.type.transducer || s.type.Transducer)))) ||
    null
  );
}

interface BoundTransducer {
  toHot: (x: unknown) => unknown;
  toNative: (x: unknown) => unknown;
}

function combineTransducer(
  transducer: { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown } | null,
  arr: Array<unknown>,
  context: unknown,
): BoundTransducer {
  let t: { toHot?: (x: unknown) => unknown; toNative?: (x: unknown) => unknown } | null = transducer;
  if (!t && Array.isArray(arr)) {
    const [toHot, toNative] = arr as [(x: unknown) => unknown, (x: unknown) => unknown];
    t = { toHot, toNative };
  }
  const identity = (x: unknown): unknown => x;
  return {
    toHot: ((t && t.toHot) || identity).bind(context),
    toNative: ((t && t.toNative) || identity).bind(context),
  };
}

/**
 * The `Transducer` value-object. Constructed once per `SettingField`, the
 * resulting `toHot` / `toNative` methods convert between the editor's "native"
 * prop value (e.g. a `JSExpression` shape) and the setter's "hot" value
 * (e.g. the live JS object the user is editing).
 *
 * Slim: the constructor mirrors ali's logic verbatim (the only delta is
 * the local `isSetterConfig` / `isDynamicSetter` re-implementations) and
 * the post-construction shape is a frozen value-object — no mutations
 * are exposed.
 */
export class Transducer {
  private readonly setterTransducer: BoundTransducer;
  private readonly context: ISettingField;

  constructor(context: ISettingField, config: { setter: IPublicTypeFieldConfig['setter'] }) {
    // Use `unknown` internally because the unwrap chain can produce values
    // whose TypeScript type does not match `IPublicTypeFieldConfig['setter']`
    // (e.g. a registered component returned from `getSetter`). Ali uses
    // `as any` everywhere; the slim port keeps the types honest by widening
    // here and re-narrowing at the call sites.
    let setter: unknown = config.setter;

    // 1. Unwrap: array form → first element
    if (Array.isArray(setter)) {
      setter = setter[0];
      // 2. Unwrap: React element of `MixedSetter` → its first inner setter
    } else if (
      isValidElement(setter) &&
      (setter as unknown as { type?: { displayName?: string } }).type?.displayName === 'MixedSetter'
    ) {
      setter = (
        setter as unknown as { props?: { setters?: IPublicTypeFieldConfig['setter'][] } }
      ).props?.setters?.[0];
      // 3. Unwrap: schema-shaped `MixedSetter` node → its first inner setter
    } else if (
      typeof setter === 'object' &&
      setter !== null &&
      (setter as { componentName?: string }).componentName === 'MixedSetter'
    ) {
      const setters = (setter as { props?: { setters?: IPublicTypeFieldConfig['setter'][] } })
        .props?.setters;
      setter = Array.isArray(setters) ? setters[0] : setter;
    }

    // 4. Static setter config (`{ componentName, isDynamic? }`) → unwrap to name
    let isDynamic = true;
    if (isSetterConfig(setter)) {
      // Slim `IPublicTypeSetterConfig` (in @monbolc/lowcode-types) does not
      // declare `isDynamic`; the ali-faithful extra is read via a narrow
      // `as` cast. Future widening: add `isDynamic?: boolean` to the types
      // package's interface and drop the cast.
      const { componentName, isDynamic: dynamicFlag } = setter as IPublicTypeSetterConfig & {
        isDynamic?: boolean;
      };
      setter = componentName;
      isDynamic = dynamicFlag !== false;
    }

    // 5. Named setter → look up via the registry; honor meta's isDynamic override
    if (typeof setter === 'string') {
      const looked = (context as unknown as { setters: { getSetter: (n: string) => unknown } })
        .setters.getSetter(setter) as { component?: unknown; isDynamic?: boolean } | undefined;
      const { component, isDynamic: dynamicFlag } = looked || {};
      setter = component;
      // 物料描述的 isDynamic 优先于 setter 自己的声明
      isDynamic = dynamicFlag === undefined ? isDynamic : dynamicFlag !== false;
    }

    // 6. Dynamic setter: invoke with the shell-field handle, both as `this` and arg
    if (isDynamicSetter(setter) && isDynamic) {
      try {
        const handle = (context as unknown as { internalToShellField?: () => unknown })
          .internalToShellField?.();
        setter = (setter as (...args: unknown[]) => unknown).call(handle, handle);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e);
      }
    }

    this.setterTransducer = combineTransducer(
      getTransducerFromSetter(setter),
      getHotterFromSetter(setter),
      context,
    );
    this.context = context;
  }

  toHot(data: unknown): unknown {
    return this.setterTransducer.toHot(data);
  }

  toNative(data: unknown): unknown {
    return this.setterTransducer.toNative(data);
  }
}
