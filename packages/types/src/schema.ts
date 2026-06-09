import type {
  IPublicTypeAsset,
  IPublicTypeComponentSchema,
  IPublicTypeDataSource,
  IPublicTypeI18nMessage,
  IPublicTypeNodeSchema,
  IPublicTypeProjectConfig,
  JSONValue,
} from './index';
import type { IPublicTypeJSExpression, IPublicTypeJSFunction, IPublicTypeJSONObject } from './js-block';

export interface IPublicTypePageSchema extends IPublicTypeNodeSchema {
  componentName: 'Page' | string;
  fileName?: string;
  dataSource?: IPublicTypeDataSource | Record<string, unknown>;
  state?: Record<string, JSONValue | IPublicTypeJSExpression | IPublicTypeJSFunction>;
  css?: string;
  lifeCycles?: Record<string, IPublicTypeJSFunction>;
  methods?: Record<string, IPublicTypeJSFunction>;
}

export interface IPublicTypeBlockSchema extends IPublicTypeNodeSchema {
  componentName: 'Block' | string;
  fileName?: string;
  title?: string;
}

export interface IPublicTypeContainerSchema extends IPublicTypeNodeSchema {
  children?: IPublicTypeNodeSchema[];
  state?: Record<string, JSONValue | IPublicTypeJSExpression | IPublicTypeJSFunction>;
  methods?: Record<string, IPublicTypeJSFunction>;
  lifeCycles?: Record<string, IPublicTypeJSFunction>;
}

export interface IPublicTypeSlotSchema extends IPublicTypeNodeSchema {
  componentName: 'Slot' | string;
  params?: string[];
  title?: string;
}

export interface IPublicTypeNpmInfo {
  package: string;
  version?: string;
  exportName?: string;
  main?: string;
  destructuring?: boolean;
  subName?: string;
}

export interface IPublicTypePackage extends IPublicTypeNpmInfo {
  library?: string;
  urls?: string[];
  editUrls?: string[];
}

export interface IPublicTypeSnippet {
  title?: string;
  screenshot?: string;
  schema: IPublicTypeNodeSchema;
}

export type IPublicTypeI18nMap = Record<string, Record<string, string | IPublicTypeI18nMessage>>;
export type IPublicTypeComponentsMap = Array<IPublicTypeComponentSchema | IPublicTypeNpmInfo>;

export interface IPublicTypeInternalUtils {
  name: string;
  type: 'function';
  content: IPublicTypeJSFunction | IPublicTypeJSExpression;
}

export interface IPublicTypeExternalUtils {
  name: string;
  type: 'npm' | 'tnpm';
  content: IPublicTypeNpmInfo;
}

export type IPublicTypeUtilItem = IPublicTypeInternalUtils | IPublicTypeExternalUtils;
export type IPublicTypeUtilsMap = IPublicTypeUtilItem[];

export interface IPublicTypeAppConfig {
  theme?: 'light' | 'dark' | string;
  locale?: string;
  [key: string]: unknown;
}

export interface IPublicTypeProjectDocument {
  id: string;
  name: string;
  slug: string;
  cover?: string;
  pages: Record<string, import('./index').IPublicTypeRootSchema>;
  components: Record<string, IPublicTypeComponentSchema>;
  assets?: Record<string, IPublicTypeAsset>;
  i18n?: Record<string, Record<string, IPublicTypeI18nMessage>>;
  dataSources?: Record<string, IPublicTypeDataSource>;
  config?: IPublicTypeProjectConfig;
  version: string;
}

export interface IPublicTypeProjectSchema<T = import('./index').IPublicTypeRootSchema> {
  id?: string;
  version: string;
  componentsMap: IPublicTypeComponentsMap;
  componentsTree: T[];
  i18n?: IPublicTypeI18nMap;
  utils?: IPublicTypeUtilsMap;
  constants?: IPublicTypeJSONObject;
  css?: string;
  dataSource?: Record<string, unknown>;
  config?: IPublicTypeAppConfig & Record<string, unknown>;
  meta?: Record<string, unknown>;
}
