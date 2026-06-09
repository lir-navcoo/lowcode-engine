/**
 * @monbolc/lowcode-types — 资源 (resource) 类型
 *
 * 上游参考: `alibaba/lowcode-engine` v1.3.2
 * `types/src/shell/type/{resource-type,resource-type-config}.ts`
 *
 * 差异 (sapu slim 端口):
 * - `IPublicResourceTypeConfig` 是 L6 shell 的详细配置(包含
 *   `editorViews` / `init` / `save` / `import` 钩子),本文件**只**
 *   导出 `IPublicTypeResourceType`(工厂签名)和最薄的
 *   `IPublicResourceTypeConfig` 类型,避免把 L6 实现细节漏到 L0。
 *   完整 L6 形状由 L6 自己扩展。
 * - `IPublicModelPluginContext` 引用改为 `unknown` —— 本包不重导
 *   出 model 层。
 */

/**
 * 资源类型描述 (L0 形状)。
 *
 * 资源是 L5 workspace 的核心概念,每条资源有自己的视图、icon、
 * 保存/导入钩子。`resourceType` 字符串是分类标签(常见值
 * `'editor'` / `'webview'` / 自定义),用于资源面板分组。
 */
export interface IPublicTypeResourceType {
  /** 资源名(L5 workspace 内唯一)。 */
  resourceName: string;
  /**
   * 资源类型分类标签。
   * - `'editor'`:由 `@monbolc/lowcode-editor-skeleton` 渲染。
   * - `'webview'`:由 `<iframe>` 渲染(`url()` 返回目标 URL)。
   * - 其他自定义值:由 host 自行处理。
   */
  resourceType: 'editor' | 'webview' | string;
  /**
   * 资源工厂。返回该资源类型的完整配置。
   *
   * `ctx` 上游是 `IPublicModelPluginContext`,sapu 改用
   * `unknown` —— 消费方窄化到自己的 context 形状。
   */
  (ctx: unknown, options: Record<string, unknown>): IPublicResourceTypeConfig;
}

/**
 * 资源类型配置(L0 形状)。
 *
 * L6 `@monbolc/lowcode-shell` 在此基础上扩展;L0 只承诺"有此
 * 形状存在"以便 typecheck。
 */
export interface IPublicResourceTypeConfig {
  /** 资源描述(可选)。 */
  description?: string;
  /** 默认标题(显示在 tab 上)。 */
  defaultTitle?: string;
  /** 默认视图名(对应 `editorViews` 中的某项)。 */
  defaultViewName: string;
  /** 该资源支持的视图列表(详细形状由 L6 扩展)。 */
  editorViews: ReadonlyArray<unknown>;
}
