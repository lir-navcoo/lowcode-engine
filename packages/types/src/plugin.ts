import type { IPublicEnumPluginRegisterLevel } from './enum';

export interface IPublicTypePluginConfig {
  [key: string]: unknown;
}

export interface IPublicTypePluginMeta {
  dependencies?: string[];
  engines?: Record<string, string>;
  preferenceDeclaration?: IPublicTypePluginDeclarationProperty[];
  [key: string]: unknown;
}

export interface IPublicTypePluginDeclarationProperty {
  key: string;
  type?: string;
  title?: string;
  description?: string;
  defaultValue?: unknown;
  required?: boolean;
  [key: string]: unknown;
}

export interface IPublicTypePluginDeclaration {
  package?: string;
  name: string;
  title?: string;
  description?: string;
  meta?: IPublicTypePluginMeta;
  preferenceDeclaration?: IPublicTypePluginDeclarationProperty[];
  [key: string]: unknown;
}

export interface IPublicTypePluginRegisterOptions {
  autoInit?: boolean;
  level?: IPublicEnumPluginRegisterLevel;
  resource?: string;
  [key: string]: unknown;
}

export interface IPublicTypePluginCreater {
  (ctx: unknown, options?: IPublicTypePluginConfig): unknown;
  pluginName?: string;
  meta?: IPublicTypePluginMeta;
}

export interface IPublicTypePlugin extends IPublicTypePluginCreater {
  pluginName: string;
  meta?: IPublicTypePluginMeta;
}
