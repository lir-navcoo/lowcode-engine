/**
 * @monbolc/lowcode-types — 命令与热键类型
 *
 * 上游参考: `alibaba/lowcode-engine` v1.3.2
 * `types/src/shell/type/{command,hotkey-callback,hotkey-callback-config}.ts`
 *
 * 差异 (sapu slim 端口):
 * - 命令的 `propType` 字段引用上游的 `IPublicTypePropType` 大联合
 *   类型(包含 `oneOf` / `oneOfType` / `arrayOf` / `shape` 等)—— 该
 *   联合 sapu 不重导出(已通过 `IPublicTypeFieldConfig.extraProps`
 *   + 字符串 setter 名覆盖同一能力)。本文件把 `propType` 类型从
 *   `string | IPublicTypePropType` 简化为 `string`,JSDoc 注明。
 * - 上游 `IPublicTypeListCommand` 是 `IPublicTypeCommand` 的子集,
 *   字段集完全一样,sapu 直接复用 `IPublicTypeCommand`。
 */

/** 命令处理函数的参数 bag;消费方按需窄化。 */
export type IPublicTypeCommandHandlerArgs = Record<string, unknown>;

/**
 * 命令的单个参数描述。
 *
 * 上游的 `propType` 是 `string | IPublicTypePropType` 大联合
 * 类型;sapu 简化为 `string` —— 复杂 prop 类型走
 * `IPublicTypeFieldConfig.extraProps` 通道。
 */
export interface IPublicTypeCommandParameter {
  /** 参数名。 */
  name: string;
  /** 参数类型(字符串标识,如 `'string'` / `'number'` / `'object'`)。 */
  propType: string;
  /** 参数的人类可读描述。 */
  description: string;
  /** 参数默认值(可选)。 */
  defaultValue?: unknown;
}

/**
 * 单条命令。
 *
 * 命名约定: 命令名遵循 `commandScope:commandName` 模式;
 * `commandScope` 来自插件 `meta`,用于跨插件命名空间隔离。
 */
export interface IPublicTypeCommand {
  /** 命令名(如 `'designer.remove'` / `'doc.save'`)。 */
  name: string;
  /** 命令参数签名。 */
  parameters?: IPublicTypeCommandParameter[];
  /** 命令描述(i18n key 或字面量)。 */
  description?: string;
  /** 命令处理函数。 */
  handler: (args: IPublicTypeCommandHandlerArgs) => void;
}

// ---------- 热键 ----------

/**
 * 热键回调。返回 `false` 表示"我处理了,阻止默认行为"。
 */
export type IPublicTypeHotkeyCallback = (e: KeyboardEvent, combo?: string) => unknown | false;

/**
 * 单条热键绑定配置。
 *
 * `combo` 是规范化后的字符串(小写、规范化分隔符),如
 * `'ctrl+s'` / `'cmd+shift+p'`;`action` 是命令名(可选,绑
 * 命令模式);`modifiers` 是修饰键列表(`'ctrl'` / `'cmd'` /
 * `'alt'` / `'shift'`)用于显示与匹配回退。
 */
export interface IPublicTypeHotkeyCallbackConfig {
  callback: IPublicTypeHotkeyCallback;
  modifiers: string[];
  /** 绑定的命令名(若有);不绑命令则只跑 callback。 */
  action: string;
  /** 序列(用于两级组合键)。 */
  seq?: string;
  /** 优先级(数字越小越高);冲突时高优先级赢。 */
  level?: number;
  /** 规范化的组合键字符串,如 `'ctrl+s'`。 */
  combo?: string;
}
