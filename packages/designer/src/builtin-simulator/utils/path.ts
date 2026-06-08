/**
 * @monbolc/lowcode-designer — path helpers (Phase B ali-mirror)
 *
 * Ali-faithful port of
 * `alibaba/lowcode-engine/packages/designer/src/builtin-simulator/utils/path.ts`.
 * Pure string/path utilities for component import paths.
 *
 * Used by:
 *   - the simulator's asset loader (Phase D's host.ts reads
 *     component imports; the normalized form is used to dedupe)
 *   - the parse-metadata helper (which inspects component
 *     imports to detect "main entry" files)
 *   - plugins that want to compare import paths from the host
 *     filesystem to the in-document component name
 *
 * No DOM, no React, no MobX. Ali-faithful algorithm.
 */

/**
 * Check whether `path` is an external package (e.g. `@ali/uxcore`)
 * or a relative/absolute path. Ali-faithful: anything that
 * doesn't start with `.` or `/` is treated as a package name.
 */
export function isPackagePath(path: string): boolean {
  return !path.startsWith('.') && !path.startsWith('/');
}

/**
 * Title-case a string. Ali-faithful: split on `[-_ .]+`, uppercase
 * the first letter of each token, rejoin.
 */
export function toTitleCase(s: string): string {
  return s
    .split(/[-_ .]+/)
    .map((token) => (token[0] ?? '').toUpperCase() + token.substring(1))
    .join('');
}

/**
 * Ali-faithful: take the basename of `path`, strip a
 * recognized extension AND an `index.<ext>` prefix, then
 * title-case the result. Returns `'Component'` for empty /
 * index-only paths.
 */
export function generateComponentName(path: string): string {
  const parts = path.split('/');
  let name = parts.pop();
  if (name) {
    const extIndex = name.lastIndexOf('.');
    if (extIndex > -1) {
      const ext = name.slice(extIndex);
      if (IGNORED_EXTENSIONS.includes(ext)) {
        name = name.slice(0, extIndex);
      }
    }
  }
  if (name && /^index$/.test(name)) {
    name = parts.pop();
  }
  return name ? toTitleCase(name) : 'Component';
}

const IGNORED_EXTENSIONS = ['.ts', '.js', '.tsx', '.jsx'];

/**
 * Ali-faithful: strip a recognized extension AND the
 * `index` basename (e.g. `dir/Header.tsx` → `dir/Header`,
 * `dir/index.ts` → `dir`). Ali's port is what the parse-metadata
 * helper uses to canonicalize import paths.
 */
export function getNormalizedImportPath(path: string): string {
  const segments = path.split('/');
  let basename = segments.pop();
  if (!basename) return path;
  const extIndex = basename.lastIndexOf('.');
  if (extIndex > -1) {
    const ext = basename.slice(extIndex);
    if (IGNORED_EXTENSIONS.includes(ext)) {
      basename = basename.slice(0, extIndex);
    }
  }
  if (basename !== 'index') {
    segments.push(basename);
  }
  return segments.join('/');
}

/**
 * Compute a relative path from `fromPath` to `toPath`. Ali-faithful
 * — both args are absolute (or both relative). For absolute
 * toPath with non-absolute fromPath, the result keeps the
 * original toPath (the user can fix up later).
 */
export function makeRelativePath(toPath: string, fromPath: string): string {
  if (!toPath.startsWith('/')) return toPath;
  const toParts = toPath.split('/');
  const fromParts = fromPath.split('/');
  const length = Math.min(fromParts.length, toParts.length);
  let sharedUpTo = length;
  for (let i = 0; i < length; i++) {
    if (fromParts[i] !== toParts[i]) {
      sharedUpTo = i;
      break;
    }
  }
  const numGoUp = fromParts.length - sharedUpTo;
  const outputParts: string[] = [];
  for (let i = 0; i < numGoUp; i++) outputParts.push('..');
  outputParts.push(...toParts.slice(sharedUpTo));
  // Empty means the target IS the source dir (no segments
  // left after slicing). Ali returns `.` for that case.
  if (outputParts.length === 0) return '.';
  // No `..` segments AND the result is relative → prefix `./`
  // so the result is unambiguously a relative path.
  if (!outputParts[0]!.startsWith('..')) {
    outputParts[0] = './' + outputParts[0];
  }
  return outputParts.join('/');
}

function normalizeArray(parts: string[], allowAboveRoot: boolean): string[] {
  const res: string[] = [];
  for (const p of parts) {
    if (!p || p === '.') continue;
    if (p === '..') {
      if (res.length && res[res.length - 1] !== '..') res.pop();
      else if (allowAboveRoot) res.push('..');
    } else res.push(p);
  }
  return res;
}

function normalize(path: string): string {
  const isAbsolute = path[0] === '/';
  const segments = normalizeArray(path.split('/'), !isAbsolute);
  if (isAbsolute) segments.unshift('');
  return segments.join('/');
}

/**
 * Ali-faithful: resolve a relative path `path` against a
 * `base` directory. If `path` is already absolute (starts
 * with `/` or a package name), returns it unchanged.
 *
 * The `base` is treated as a FILE path when `path` starts with
 * `..` (so `..` climbs from base's parent dir), and as a
 * DIRECTORY otherwise (so `./foo` is appended to base).
 */
export function resolveAbsoluatePath(path: string, base: string): string {
  if (!path.startsWith('.')) return path;
  path = path.replace(/\\/g, '/');
  const goingUp = path === '..' || path.startsWith('../') || path.startsWith('./..');
  const baseDir = goingUp
    ? base.replace(/\/[^/]*$/, '/')  // strip last segment, ensure trailing /
    : (base.endsWith('/') ? base : base + '/');
  return normalize(baseDir + path);
}

/**
 * Ali-faithful: join N path segments, normalize, and return.
 * Empty segments are skipped.
 */
export function joinPath(...segments: string[]): string {
  let path = '';
  for (const seg of segments) {
    if (seg) {
      if (path === '') path += seg;
      else path += `/${seg}`;
    }
  }
  return normalize(path);
}

/**
 * Ali-faithful: strip a `@version` suffix from an import
 * path. `lodash@4.17.21/foo` → `lodash/foo`,
 * `@scope/pkg@1.2.3` → `@scope/pkg`.
 *
 * The version suffix is identified by a `@<digit>` lead
 * (i.e. `@1.2.3`, `@4.17.21`). The leading `@scope` of a
 * scoped package is preserved because it does not start with
 * a digit.
 */
export function removeVersion(path: string): string {
  return path.replace(/(@\d[\w.-]*)/g, '');
}
