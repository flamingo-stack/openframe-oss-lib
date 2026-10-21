/**
 * How many items a list skeleton draws is never a number typed at the call site (the loading standard, rule 4): a
 * paged list draws its page size, a limited one its limit, an unbounded one a DECLARED `*_SKELETON_*` constant. A
 * literal in a `skeletonRows=` / `skeletonCount=` prop, a literal default for either, or a `?? <digits>` fallback in a
 * `skeletonRows` / `pageSize` expression is a count written twice, and drifts from the list it stands for.
 *
 * Kept on purpose: the deprecated whole-view re-exports (`TrustCenterPageSkeleton`, `DetailPageSkeleton`) older
 * hosts still import.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..');

/** Files kept for older hosts, whatever they hold. */
const KEPT = /(?:^|\/)(?:trust-center-page-skeleton|detail-page-skeleton|deprecated-layout-skeletons)\.tsx$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' || name === 'node_modules' ? [] : sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.(stories|test)\.tsx?$/.test(name) ? [path] : [];
  });
}

const RULES: Array<[string, RegExp]> = [
  ['a literal skeleton count prop', /\b(?:skeletonRows|skeletonCount)=\{\s*\d+\s*\}/],
  ['a literal skeleton count default', /(?<!\b(?:let|const|var)\s+)\b(?:skeletonRows|skeletonCount)\s*=\s*\d+\s*[,})]/],
  ['a literal fallback in a skeletonRows / pageSize expression', /\b(?:skeletonRows|pageSize)\b[^;\n]*\?\?\s*\d+/],
];

/** Every offending line, as `path:line: rule`. */
function skeletonCountOffenders(files: Array<{ path: string; text: string }>): string[] {
  return files.flatMap(({ path, text }) =>
    text
      .split('\n')
      .flatMap((line, index) =>
        RULES.filter(([, re]) => re.test(line)).map(([rule]) => `${path}:${index + 1}: ${rule}`),
      ),
  );
}

describe('skeleton counts', () => {
  it('the rules catch what they name, and pass a declared constant', () => {
    const offenders = skeletonCountOffenders([
      { path: 'a.tsx', text: '<DataTable.Body skeletonRows={8} />' },
      { path: 'b.tsx', text: '  skeletonCount = 24,' },
      { path: 'c.tsx', text: '<Grid skeletonRows={pageSize ?? 10} />' },
      { path: 'ok.tsx', text: '  skeletonRows = DEVICES_LIST_SKELETON_ROWS,\n<Body skeletonRows={pageSize} />' },
      { path: 'local.ts', text: 'let skeletonRows = 0;' },
    ]);
    expect(offenders.map(o => o.split(':')[0])).toEqual(['a.tsx', 'b.tsx', 'c.tsx']);
  });

  it('no list skeleton count is a literal in the library', () => {
    const files = sourceFiles(SRC)
      .map(path => relative(SRC, path))
      .filter(path => !KEPT.test(path))
      .map(path => ({ path, text: readFileSync(join(SRC, path), 'utf8') }));
    expect(skeletonCountOffenders(files)).toEqual([]);
  });
});
