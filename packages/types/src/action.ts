import type { IPublicTypeIconType } from './presentational';
import type { IPublicTypeTitleContent } from './presentational';

export interface IPublicTypeActionContentObject {
  icon?: IPublicTypeIconType;
  title?: IPublicTypeTitleContent;
  action?: (currentNode: unknown) => void;
  condition?: (currentNode: unknown) => boolean;
  disabled?: (currentNode: unknown) => boolean;
  name?: string;
  important?: boolean;
  builtIn?: boolean;
  extra?: Record<string, unknown>;
}
