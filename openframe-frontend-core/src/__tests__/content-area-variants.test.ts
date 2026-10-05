/**
 * The `content-*` Tailwind variants (`odsContentAreaPlugin` in tailwind.config.ts).
 * Page content switches layout on them, so they must keep both halves: the
 * content-area container query, and the viewport fallback that keeps every app
 * without a docked side panel (and every overlay portalled out of `<main>`)
 * exactly as it was with `md:` / `lg:`. See "Content area breakpoints" in
 * ODS_TOKEN_RULES.md.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AtRule, type Root, type Rule } from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';

/** Utilities generated for `classes` (plus the config's safelist). */
async function compile(classes: string) {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: `<div class="${classes}"></div>`, extension: 'html' }] }),
  ]).process('@tailwind utilities;', { from: undefined });
  return result.root;
}

/** `"@<at-rule> <params> | <selector>"` for every rule of the class, in order. */
function rulesOf(root: Root, className: string) {
  const escaped = `.${className.replace(/:/g, '\\:')}`;
  const found: string[] = [];
  root.walkRules((rule: Rule) => {
    if (!rule.selector.startsWith(escaped)) return;
    const parent = rule.parent as AtRule | undefined;
    found.push(`@${parent?.name} ${parent?.params} | ${rule.selector}`);
  });
  return found;
}

const OUTSIDE = ':where(:not(.ods-content-area *))';

/** Every rule of the class as its at-rule ancestry, outermost first. */
function chainsOf(root: Root, className: string) {
  const escaped = `.${className.replace(/:/g, '\\:')}`;
  const found: string[] = [];
  root.walkRules((rule: Rule) => {
    if (!rule.selector.startsWith(escaped)) return;
    const chain: string[] = [];
    for (let node = rule.parent; node && node.type === 'atrule'; node = node.parent) {
      const atRule = node as AtRule;
      chain.unshift(`@${atRule.name} ${atRule.params}`);
    }
    found.push(chain.join(' > ') + (rule.selector.endsWith(OUTSIDE) ? ' [outside]' : ''));
  });
  return found;
}

describe('content-* variants', () => {
  it.each([
    ['sm', 640, 640],
    ['md', 720, 800],
    ['lg', 1024, 1280],
    ['xl', 1216, 1440],
    ['2xl', 1312, 1536],
  ])('content-%s: %ipx of content inside a content area, %ipx of viewport outside', async (step, content, viewport) => {
    const root = await compile(`content-${step}:grid`);
    const cls = `.content-${step}\\:grid`;
    expect(rulesOf(root, `content-${step}:grid`)).toEqual([
      `@container ods-content (min-width: ${content}px) | ${cls}`,
      `@media (min-width: ${viewport}px) | ${cls}${OUTSIDE}`,
    ]);
  });

  it.each([
    ['md', 720, 800],
    ['lg', 1024, 1280],
  ])('content-max-%s: under %ipx of content, under %ipx of viewport outside', async (step, content, viewport) => {
    const root = await compile(`content-max-${step}:grid`);
    const cls = `.content-max-${step}\\:grid`;
    expect(rulesOf(root, `content-max-${step}:grid`)).toEqual([
      `@container ods-content (max-width: ${content - 0.02}px) | ${cls}`,
      `@media (max-width: ${viewport - 0.02}px) | ${cls}${OUTSIDE}`,
    ]);
  });

  it('stacks under md: for chrome that also needs the window wide (PageActions)', async () => {
    const root = await compile('md:content-md:flex md:content-max-md:flex');
    expect(chainsOf(root, 'md:content-md:flex')).toEqual([
      '@media (min-width: 800px) > @container ods-content (min-width: 720px)',
      '@media (min-width: 800px) > @media (min-width: 800px) [outside]',
    ]);
    // Inside a content area: a narrow content area in a wide window. Outside one it
    // can never match: at least 800px and under 800px at once.
    expect(chainsOf(root, 'md:content-max-md:flex')).toEqual([
      '@media (min-width: 800px) > @container ods-content (max-width: 719.98px)',
      '@media (min-width: 800px) > @media (max-width: 799.98px) [outside]',
    ]);
  });

  it('safelists the classes DataTable builds at runtime (`hideAt`)', async () => {
    const root = await compile('');
    for (const step of ['md', 'lg', 'xl', '2xl']) {
      expect(rulesOf(root, `content-${step}:hidden`)).toHaveLength(2);
      expect(rulesOf(root, `content-${step}:flex`)).toHaveLength(2);
    }
  });
});

/** `--name: value` declared directly in rules matching `selector` under `atRule` (or at the top level). */
function declarations(root: Root, selector: string, atRule?: string) {
  const found = new Map<string, string>();
  root.walkRules(rule => {
    if (!rule.selectors.includes(selector)) return;
    const parent = rule.parent as AtRule | Root;
    const params = parent.type === 'atrule' ? `@${parent.name} ${parent.params}` : undefined;
    if (params !== atRule) return;
    rule.walkDecls(/^--/, decl => {
      found.set(decl.prop, decl.value);
    });
  });
  return found;
}

describe('content-area tokens', () => {
  const styles = resolve(__dirname, '../styles');
  const responsive = postcss.parse(readFileSync(resolve(styles, 'ods-responsive-tokens.css'), 'utf8'));
  const contentArea = postcss.parse(readFileSync(resolve(styles, 'ods-content-area.css'), 'utf8'));

  it('makes <main> the ods-content container the variants query', () => {
    const decls: string[] = [];
    contentArea.walkRules('.ods-content-area', rule =>
      rule.walkDecls(decl => void decls.push(`${decl.prop}: ${decl.value}`)),
    );
    expect(decls).toEqual(['container: ods-content / inline-size']);
  });

  it('restates every viewport token on .ods-viewport-layer, for window chrome inside a content area', () => {
    for (const atRule of [undefined, '@media (min-width: 800px)', '@media (min-width: 1280px)']) {
      const onRoot = declarations(responsive, ':root', atRule);
      expect(onRoot.size).toBeGreaterThan(0);
      expect(declarations(responsive, '.ods-viewport-layer', atRule)).toEqual(onRoot);
    }
  });

  it('re-declares, under 720px of content, the mobile value of every token the viewport steps change', () => {
    const mobile = declarations(responsive, ':root');
    // Fixed tokens (`*-f`, `xxs`, ...) are re-stated by the steps unchanged.
    const changedAbove = new Set(
      [
        ...declarations(responsive, ':root', '@media (min-width: 800px)'),
        ...declarations(responsive, ':root', '@media (min-width: 1280px)'),
      ]
        .filter(([name, value]) => mobile.get(name) !== value)
        .map(([name]) => name),
    );
    expect(changedAbove.size).toBeGreaterThan(0);
    const scope = declarations(contentArea, '.ods-content-scope', '@container ods-content (max-width: 719.98px)');

    const expected = Object.fromEntries([...changedAbove].map(name => [name, mobile.get(name)]));
    const actual = Object.fromEntries([...changedAbove].map(name => [name, scope.get(name)]));
    expect(actual).toEqual(expected);
  });
});
