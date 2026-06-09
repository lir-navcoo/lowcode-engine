import type { IPublicTypeComponentSchema, IPublicTypeFieldConfig } from './index';
import type { IPublicTypeI18nData, IPublicTypeIconType, IPublicTypeTitleContent } from './presentational';
import type { IPublicTypeNpmInfo, IPublicTypeSnippet } from './schema';
import type { IPublicTypePropConfig } from './field-config';
import type { IPublicTypeAdvanced, IPublicTypeConfigure } from './transducer';

export type IPublicTypeComponentInstance = Element | object;

export interface IPublicTypeComponentMetadata {
  [key: string]: unknown;
  componentName: string;
  uri?: string;
  title?: IPublicTypeTitleContent;
  icon?: IPublicTypeIconType;
  tags?: string[];
  description?: string;
  docUrl?: string;
  screenshot?: string;
  devMode?: 'proCode' | 'lowCode';
  npm?: IPublicTypeNpmInfo;
  props?: IPublicTypePropConfig[];
  configure?: IPublicTypeFieldConfig[] | IPublicTypeConfigure;
  experimental?: IPublicTypeAdvanced;
  schema?: IPublicTypeComponentSchema;
  snippets?: IPublicTypeSnippet[];
  group?: string | IPublicTypeI18nData;
  category?: string | IPublicTypeI18nData;
  priority?: number;
}

export type IPublicTypeComponentDescription = IPublicTypeComponentMetadata;
export type IPublicTypeRemoteComponentDescription = IPublicTypeComponentMetadata & {
  exportName?: string;
  main?: string;
  destructuring?: boolean;
  subName?: string;
};

export interface IPublicTypeComponentAction {
  name: string;
  title?: IPublicTypeTitleContent;
  icon?: IPublicTypeIconType;
  important?: boolean;
  condition?: (currentNode: unknown) => boolean;
  disabled?: (currentNode: unknown) => boolean;
  action?: (currentNode: unknown) => void;
}

export type IPublicTypeComponentSort =
  | ((a: IPublicTypeComponentMetadata, b: IPublicTypeComponentMetadata) => number)
  | string[];
