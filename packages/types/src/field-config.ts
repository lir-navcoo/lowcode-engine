import type { IPublicTypeSetterConfig } from './index';
import type { IPublicTypeCompositeValue } from './js-block';

export type IPublicTypeSetterType = string | IPublicTypeSetterConfig | IPublicTypeDynamicSetter;

export type IPublicTypeDynamicSetter = (target: unknown) => IPublicTypeSetterType | undefined;

export interface IPublicTypeRegisteredSetter {
  componentName: string;
  title?: string;
  props?: Record<string, unknown>;
}

export type IPublicTypeBasicType =
  | 'string'
  | 'number'
  | 'bool'
  | 'boolean'
  | 'object'
  | 'array'
  | 'func'
  | 'function'
  | 'node'
  | 'element'
  | 'any';

export interface IPublicTypeOneOf {
  type: 'oneOf';
  value: IPublicTypeCompositeValue[];
}

export interface IPublicTypeOneOfType {
  type: 'oneOfType';
  value: IPublicTypePropType[];
}

export interface IPublicTypeArrayOf {
  type: 'arrayOf';
  value: IPublicTypePropType;
}

export interface IPublicTypeObjectOf {
  type: 'objectOf';
  value: IPublicTypePropType;
}

export interface IPublicTypeShape {
  type: 'shape';
  value: Record<string, IPublicTypePropType>;
}

export interface IPublicTypeInstanceOf {
  type: 'instanceOf';
  value: string | unknown;
}

export interface IPublicTypeExact {
  type: 'exact';
  value: Record<string, IPublicTypePropType>;
}

export type IPublicTypeComplexType =
  | IPublicTypeOneOf
  | IPublicTypeOneOfType
  | IPublicTypeArrayOf
  | IPublicTypeObjectOf
  | IPublicTypeShape
  | IPublicTypeInstanceOf
  | IPublicTypeExact;

export type IPublicTypePropType = IPublicTypeBasicType | IPublicTypeComplexType;
export type IPublicTypePropTypes = Record<string, IPublicTypePropType>;

export interface IPublicTypePropConfig {
  name: string;
  propType: IPublicTypePropType;
  description?: string;
  defaultValue?: IPublicTypeCompositeValue;
  setter?: IPublicTypeSetterType;
}

export interface IPublicTypeFieldExtraProps {
  defaultValue?: IPublicTypeCompositeValue;
  [key: string]: unknown;
}
