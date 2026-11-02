/**
 * Tailwind 3 applies stacked variants right to left, so a state variant in FRONT of an arbitrary descendant
 * variant lands on the descendant: `data-[state=active]:[&_svg]:fill-x` compiles to `.c svg[data-state="active"]`
 * and `disabled:[&_svg]:x` to `.c svg:disabled`, selectors that never match. The control's state goes AFTER the
 * descendant variant (`[&_svg]:data-[state=active]:fill-x` -> `.c[data-state="active"] svg`).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import postcss, { type Rule } from 'postcss';
import tailwindcss from 'tailwindcss';
import { describe, expect, it } from 'vitest';
import config from '../../tailwind.config';
import { BUTTON_KIND_CLASS } from '../components/ui/button/button-styles';

const SRC = resolve(__dirname, '..');

/** Selectors generated for `className`. */
async function selectorsOf(className: string) {
  const result = await postcss([
    tailwindcss({ ...config, content: [{ raw: `<div class="${className}"></div>`, extension: 'html' }] }),
  ]).process('@tailwind utilities;', { from: undefined });
  const escaped = `.${className.replace(/[[\]&=:]/g, m => `\\${m}`)}`;
  const found: string[] = [];
  result.root.walkRules((rule: Rule) => {
    if (rule.selector.startsWith(escaped)) found.push(rule.selector.slice(escaped.length));
  });
  return found;
}

/** A class's variants, split on the colons outside brackets (`has-[:disabled]` stays whole). */
function variantsOf(cls: string) {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < cls.length; i++) {
    if (cls[i] === '[') depth++;
    else if (cls[i] === ']') depth--;
    else if (cls[i] === ':' && depth === 0) {
      parts.push(cls.slice(start, i));
      start = i + 1;
    }
  }
  return parts;
}

/** Variants that wrap the rule (an at-rule) or prefix it (an ancestor), so their place in the stack is free. */
const ORDER_FREE =
  /^(?:(?:max-|min-)?(?:sm|md|lg|xl|2xl)|content-[\w-]+|group(?:-[\w-]+|-\[[^\]]*\])?(?:\/\w+)?|peer(?:-[\w-]+|-\[[^\]]*\])?(?:\/\w+)?|dark|print|motion-safe|motion-reduce|ltr|rtl)$/;

function misordered(cls: string) {
  const variants = variantsOf(cls);
  const descendant = variants.findIndex(v => v.startsWith('[&'));
  return descendant > 0 && !variants.slice(0, descendant).every(v => ORDER_FREE.test(v));
}

describe('a variant on a descendant', () => {
  it('the current rail entry tints its glyph through the row’s own state', async () => {
    const glyph = BUTTON_KIND_CLASS.rail.split(/\s+/).find(cls => cls.endsWith(':fill-ods-accent'));
    expect(await selectorsOf(glyph ?? '')).toEqual(['[data-state="active"] svg']);
  });

  it('no class in the lib puts a state variant in front of a descendant variant', () => {
    const offenders = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
      .filter(file => /\.tsx?$/.test(file) && !file.includes('__tests__'))
      .flatMap(file =>
        readFileSync(join(SRC, file), 'utf8')
          .split(/[\s'"`]+/)
          .filter(cls => cls.includes(':[&') && misordered(cls))
          .map(cls => `${file}: ${cls}`),
      );
    expect(offenders).toEqual([]);
  });
});
