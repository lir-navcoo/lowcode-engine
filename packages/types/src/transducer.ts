import type { IPublicEnumTransformStage } from './enum';
import type { IPublicTypeCompositeObject } from './js-block';
import type { IPublicTypeFieldConfig } from './index';
import type { IPublicTypeComponentMetadata } from './component-meta';

export interface IPublicTypeAdvanced {
  callbacks?: Record<string, unknown>;
  initialChildren?: unknown;
  initialProps?: Record<string, unknown>;
  loop?: boolean;
  condition?: boolean;
  [key: string]: unknown;
}

export interface IPublicTypeConfigure {
  props?: IPublicTypeFieldConfig[];
  supports?: Record<string, unknown>;
  component?: Record<string, unknown>;
  advanced?: IPublicTypeAdvanced;
  [key: string]: unknown;
}

export interface IPublicTypeSkeletonConfig {
  [key: string]: unknown;
}

export interface IPublicTypeConfigTransducer {
  (prev: IPublicTypeSkeletonConfig): IPublicTypeSkeletonConfig;
  level?: number;
  id?: string;
}

export type IPublicTypeTransformedComponentMetadata = IPublicTypeComponentMetadata & {
  configure?: IPublicTypeConfigure;
  [key: string]: unknown;
};

export interface IPublicTypeMetadataTransducer {
  (prev: IPublicTypeTransformedComponentMetadata): IPublicTypeTransformedComponentMetadata;
  level?: number;
  id?: string;
}

export type IPublicTypePropsTransducer = (
  props: IPublicTypeCompositeObject,
  node: unknown,
  ctx?: { stage: IPublicEnumTransformStage },
) => IPublicTypeCompositeObject;
