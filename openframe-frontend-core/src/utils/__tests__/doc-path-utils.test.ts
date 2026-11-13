import { describe, expect, it } from 'vitest';
import { docRoutePath, docTreePathOfRoute, sanitizeDocPath } from '../doc-path-utils';

describe('doc path rules', () => {
  it('strips a hostile tree path to one a docs route may hold', () => {
    expect(sanitizeDocPath('../../etc/passwd?x=1')).toBe('etc/passwdx1');
    expect(sanitizeDocPath('docs/./setup guide.md')).toBe('docs/setupguide.md');
    expect(sanitizeDocPath('')).toBe('');
  });

  it("joins a viewer's route and a tree path into the doc's address, segment by segment", () => {
    expect(docRoutePath('/knowledge-base/', 'docs/setup.md')).toBe('/knowledge-base/docs/setup.md');
    expect(docRoutePath('/kb', 'a b/@c+d.md')).toBe('/kb/a%20b/@c+d.md');
    expect(docRoutePath('/kb', '../x/./y?#z')).toBe('/kb/x/y%3F%23z');
  });

  it('reads the tree path back from a route tail', () => {
    for (const path of ['docs/setup.md', 'a b/@c+d.md', 'ünï/çode.md']) {
      const route = docRoutePath('/kb', path);
      expect(docTreePathOfRoute(route.slice('/kb/'.length))).toBe(path);
    }
    expect(docTreePathOfRoute('docs/setup.md?tab=1#h')).toBe('docs/setup.md');
    expect(docTreePathOfRoute('bad%zz')).toBe('bad%zz');
  });
});
