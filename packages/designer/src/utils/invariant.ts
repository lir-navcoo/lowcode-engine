/**
 * @monbolc/lowcode-designer — invariant (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/utils/invariant.ts`.
 * 5 LoC. Throws a `[designer] Invariant failed: <message>` if
 * `check` is falsy. Ali wraps the message with the optional
 * `thing` name for context; we keep the same.
 *
 * Ali's signature uses `any` (their ESLint rule bans
 * `Function` but allows `any`). We tighten to `unknown` for
 * the new port (sapu's lint rules allow it).
 */
export function invariant(check: unknown, message: string, thing?: unknown): void {
  if (!check) {
    throw new Error(
      `[designer] Invariant failed: ${message}${thing ? ` in '${String(thing)}'` : ''}`,
    );
  }
}
