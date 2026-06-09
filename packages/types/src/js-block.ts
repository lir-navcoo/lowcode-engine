import type { IPublicTypeNodeData, IPublicTypeNodeSchema } from './index';

export interface IPublicTypeJSExpression {
  type: 'JSExpression';
  value: string;
  mock?: unknown;
  compiled?: string;
}

export interface IPublicTypeJSFunction {
  type: 'JSFunction';
  value: string;
  compiled?: string;
  mock?: unknown;
  [key: string]: unknown;
}

export interface IPublicTypeJSSlot {
  type: 'JSSlot';
  title?: string;
  id?: string;
  params?: string[];
  value?: IPublicTypeNodeData[] | IPublicTypeNodeData;
  name?: string;
}

export interface IPublicTypeJSBlock {
  type: 'JSBlock';
  value: IPublicTypeNodeSchema;
}

export type IPublicTypeJSONValue =
  | boolean
  | string
  | number
  | null
  | undefined
  | IPublicTypeJSONArray
  | IPublicTypeJSONObject;

export type IPublicTypeJSONArray = IPublicTypeJSONValue[];

export interface IPublicTypeJSONObject {
  [key: string]: IPublicTypeJSONValue;
}

export type IPublicTypeCompositeValue =
  | IPublicTypeJSONValue
  | IPublicTypeJSExpression
  | IPublicTypeJSFunction
  | IPublicTypeJSSlot
  | IPublicTypeCompositeArray
  | IPublicTypeCompositeObject;

export type IPublicTypeCompositeArray = IPublicTypeCompositeValue[];

export interface IPublicTypeCompositeObject<T = IPublicTypeCompositeValue> {
  [key: string]: IPublicTypeCompositeValue | T;
}

