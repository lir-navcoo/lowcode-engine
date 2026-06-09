export enum IPublicEnumContextMenuType {
  SEPARATOR = 'separator',
  MENU_ITEM = 'menuItem',
  NODE_TREE = 'nodeTree',
}

export enum IPublicEnumDragObjectType {
  Node = 'node',
  NodeData = 'nodedata',
  Any = 'any',
}

export enum IPublicEnumEventNames {
}

export enum IPublicEnumPluginRegisterLevel {
  Default = 'default',
  Workspace = 'workspace',
  Resource = 'resource',
  EditorView = 'editorView',
}

export enum IPublicEnumPropValueChangedType {
  SET_VALUE = 'SET_VALUE',
  SUB_VALUE_CHANGE = 'SUB_VALUE_CHANGE',
}

export enum IPublicEnumTransformStage {
  Render = 'render',
  Serilize = 'serilize',
  Save = 'save',
  Clone = 'clone',
  Init = 'init',
  Upgrade = 'upgrade',
}

export enum IPublicEnumTransitionType {
  REPAINT = 'REPAINT',
}
