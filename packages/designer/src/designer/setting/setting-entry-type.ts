/**
 * @monbolc/lowcode-designer — setting/setting-entry-type
 * Ali-mirror Phase D.S1: the `ISettingEntry` interface contract.
 *
 * Slim port of `alibaba/lowcode-engine/packages/designer/src/designer/setting/setting-entry-type.ts`.
 * The file is 100% pure type declarations — no mobx, no React, no state, no
 * Emitter. The shape is the public contract that `SettingTopEntry` (Phase D.S4)
 * and `SettingField` (Phase D.S3) implement. The slim `ISettingField` stub
 * here is the seed for S3 — S3 will define `class SettingField implements
 * ISettingField` and may extend the interface.
 *
 * Ali dependencies removed (none of these exist in @monbolc scope; slim
 * equivalents are declared locally or imported from sapu):
 *   - `@alilc/lowcode-types.IPublicApiSetters`        → local slim interface
 *   - `@alilc/lowcode-types.IPublicModelEditor`       → local slim interface
 *   - `../designer.IDesigner`                          → sapu `Project`
 *   - `../../document.INode`                           → sapu `Node`
 *   - `./setting-field.ISettingField`                  → local seed (expanded in S3)
 */
import type { Project } from '../../project';
import type { Node } from '../../node';

/**
 * Public setter registry facade used by the setting tree. The ali surface
 * is much larger (`registerSetter`, `getSetters`, `setters` proxy, etc.);
 * sapu only needs the one method Transducer calls.
 */
export interface IPublicApiSetters {
  getSetter(name: string): unknown;
}

/**
 * Public editor facade. Ali uses this in ISettingEntry for read-only access
 * to the editor (locale, theme, etc.). The slim port keeps the type but
 * leaves the surface empty — S4 (SettingTopEntry) will widen as needed.
 */
export interface IPublicModelEditor {
  // Reserved for future widening; S1 keeps it empty.
}

/**
 * Slim seed of the `ISettingField` contract. Phase D.S3 defines
 * `class SettingField implements ISettingField` and will add more members
 * via either interface merging or extension. The `internalToShellField`
 * optional method is the only piece `Transducer` (utils.ts) reads at
 * construction time — it stays optional so S1's tests can build a Transducer
 * against a minimal context.
 */
export interface ISettingField {
  readonly id: string;
  readonly name: string | number;
  readonly path: string[];
  internalToShellField?(): unknown;
}

/**
 * The base contract for a settings-panel entry. Implemented by
 * `SettingTopEntry` (Phase D.S4) and `SettingField` (Phase D.S3).
 */
export interface ISettingEntry {
  /** The owning designer / project; may be `undefined` when the entry is detached. */
  readonly designer: Project | undefined;

  /** Unique id within the project (comma-joined sorted node ids for top entry). */
  readonly id: string;

  /** True when all underlying nodes share the same component type. */
  readonly isSameComponent: boolean;

  /** True when there is exactly one underlying node. */
  readonly isSingle: boolean;

  /** True when there is more than one underlying node. */
  readonly isMultiple: boolean;

  /** Editor facade (locale, theme, etc.). Slim — see `IPublicModelEditor`. */
  readonly editor: IPublicModelEditor;

  /** Setter registry. Slim — see `IPublicApiSetters`. */
  readonly setters: IPublicApiSetters;

  /** Look up a child setting field by dotted name (e.g. `'style.fontSize'`). */
  get: (propName: string | number) => ISettingField | null;

  /** The underlying document nodes this entry edits. */
  readonly nodes: Node[];

  /**
   * Get the first underlying node. Ali types this as `any` ("@todo 补充
   * node 定义" at L40); the slim port keeps the same shape.
   */
  getNode: () => unknown;
}
