/**
 * Every link the lib renders or follows decides where it goes in ONE place, `navLinkTarget`
 * (`utils/nav-anchor-props.ts`), and executes in ONE place, `executeNavigation` / `executeNavigationImperative`
 * (`utils/execute-navigation.ts`). This test reads the source and fails on a direct call to the decision primitives
 * anywhere else, so a surface that starts deciding on its own again (a chip, a card, a search row) is caught here.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(__dirname, '..', '..', '..');

/** The routing module itself: where the primitives are defined and composed. */
const ROUTING_FILES = new Set([
  'components/chat/utils/nav-anchor-props.ts',
  'components/chat/utils/decide-new-tab.ts',
  'components/chat/utils/is-cross-origin-url.ts',
  'components/chat/utils/chat-nav-resolution.ts',
  'components/chat/utils/execute-navigation.ts',
]);

/** A CALL of a decision primitive (an import or a mention in prose is not a call). */
const DECISION_CALL = /\b(computeIsNewTab|decideNewTab|resolveHrefForRuntime|isCrossOriginUrl)\s*\(/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('navigation SSOT', () => {
  it('no file outside the routing module calls a decision primitive directly', () => {
    const offenders = sourceFiles(SRC)
      .map(path => relative(SRC, path))
      .filter(file => !ROUTING_FILES.has(file))
      .flatMap(file =>
        readFileSync(join(SRC, file), 'utf8')
          .split('\n')
          .flatMap((line, i) =>
            !line.trim().startsWith('//') && !line.trim().startsWith('*') && DECISION_CALL.test(line)
              ? [`${file}:${i + 1}: ${line.trim()}`]
              : [],
          ),
      );
    expect(offenders).toEqual([]);
  });
});
