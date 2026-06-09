/**
 * @monbolc/lowcode-designer — setting/is-js-expression
 *
 * Local slim re-implementation of `@alilc/lowcode-utils.isJSExpression`.
 * Ali's helper checks `value.type === 'JSExpression' && typeof value.value === 'string'`.
 * The slim port uses just the `type` discriminator — callers that need
 * the value-side narrow can add the `typeof === 'string'` check.
 *
 * Lives in its own file so S2 / S3 / S4 can import without circular deps.
 */
export function isJSExpression(
  v: unknown,
): v is { type: 'JSExpression'; value?: unknown; mock?: unknown } {
  return !!v && typeof v === 'object' && (v as { type?: string }).type === 'JSExpression';
}
