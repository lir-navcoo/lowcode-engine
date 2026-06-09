/**
 * @monbolc/lowcode-engine — setting/setting-top-entry
 *
 * Phase D.S2 forward-declaration of `ISettingTopEntry` (S4 will replace
 * with the real class). Slim re-declaration: the real class lives in
 * `alibaba/lowcode-engine/packages/designer/src/designer/setting/setting-top-entry.ts`
 * (297 LoC, 1 mobx typo on a method).
 *
 * The S2 import of `ISettingTopEntry` (from `setting-prop-entry.ts`)
 * resolves to this stub until S4 lands. Once S4 ships, the class
 * declares `implements ISettingTopEntry` and the interface stays as
 * the public contract.
 */
import type { Node } from '../../node';
import type { ISettingField } from './setting-entry-type';
import type { IPublicTypeSetValueOptions } from './setting-prop-entry';

/**
 * The top-level setting entry. One per selection: when the user selects
 * one node, there's one `SettingTopEntry`; when they select N, there's
 * still one (with `nodes.length === N`). Owns the `items` tree.
 */
export interface ISettingTopEntry {
  readonly id: string;
  readonly nodes: Node[];
  readonly isSameComponent: boolean;
  readonly isSingle: boolean;
  readonly isMultiple: boolean;
  readonly componentMeta: unknown;
  readonly top: ISettingTopEntry;
  readonly path: string[];
  readonly items: ISettingField[];
  getPropValue(name: string | number): unknown;
  setPropValue(name: string | number, val: unknown): void;
  clearPropValue(name: string | number): void;
  getPropValue(path: string): unknown;
  getExtraPropValue(name: string): unknown;
  setExtraPropValue(name: string, value: unknown): void;
  get(path: string): ISettingField | null;
  valueChange?(options: IPublicTypeSetValueOptions): void;
}
