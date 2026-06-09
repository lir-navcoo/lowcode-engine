export interface IPublicTypeEditorViewConfig {
  name: string;
  title?: string;
  viewName?: string;
  type?: string;
  index?: number;
  [key: string]: unknown;
}

export interface IPublicTypeEditorView extends IPublicTypeEditorViewConfig {
  id?: string;
  active?: boolean;
  resource?: unknown;
  dispose?: () => void;
}

export type IPublicTypeEditorValueKey = string;
export interface IPublicTypeEditorGetOptions { [key: string]: unknown }
export type IPublicTypeEditorGetResult<T = unknown> = T | undefined;
export interface IPublicTypeEditorRegisterOptions { [key: string]: unknown }
export interface IPublicTypeEditor { [key: string]: unknown }
