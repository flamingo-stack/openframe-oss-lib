#!/usr/bin/env node
/**
 * Stands in for a build step: this package ships plain ESM, so the only thing
 * worth verifying before publish is that every entry point loads and produces
 * the shape ESLint expects. The release workflow runs `npm run build`, and
 * test.yml runs `type-check` and `test:run`, all three of which land here.
 *
 * `./next` is loaded only when `next` resolves — CI installs the package's own
 * dependencies but not the optional Next peer, and a missing peer is not a
 * broken config.
 */
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const hasNext = (() => {
  try {
    require.resolve('next/package.json');
    return true;
  } catch {
    return false;
  }
})();

/** Every flat-config entry must be a non-empty array of plain config objects. */
function assertFlatConfig(name, value) {
  assert.ok(Array.isArray(value), `${name}: expected an array, got ${typeof value}`);
  assert.ok(value.length > 0, `${name}: empty config array`);
  for (const [i, entry] of value.entries()) {
    assert.equal(typeof entry, 'object', `${name}[${i}]: not an object`);
    assert.notEqual(entry, null, `${name}[${i}]: null entry`);
  }
}

const entries = [
  ['./eslint-config', './index.js'],
  ['./eslint-config/base', './base.js'],
  ['./eslint-config/react', './react.js'],
  ['./eslint-config/relay', './relay.js'],
  ['./eslint-config/storybook', './storybook.js'],
  ['./eslint-config/type-checked', './type-checked.js'],
  ['./eslint-config/prettier-compat', './prettier-compat.js'],
  ['./eslint-config/cycles', './cycles.js'],
  ['./eslint-config/tests', './tests.js'],
  ...(hasNext ? [['./eslint-config/next', './next.js']] : []),
];

for (const [name, path] of entries) {
  const mod = await import(new URL(path, import.meta.url).href);
  assertFlatConfig(name, mod.default);
  console.log(`ok  ${name.padEnd(16)} ${mod.default.length} config objects`);
}

const { ignores } = await import('./ignores.js');
assert.ok(Array.isArray(ignores) && ignores.length > 0, './eslint-config/ignores: expected a non-empty array');
assert.ok(
  ignores.includes('**/__generated__/**'),
  './eslint-config/ignores: generated Relay artifacts must stay unlinted',
);
console.log(`ok  ./eslint-config/ignores        ${ignores.length} patterns`);

const { default: prettierConfig } = await import('./prettier.js');
assert.equal(prettierConfig.printWidth, 120, './eslint-config/prettier: must match the Biome formatter width');
assert.equal(prettierConfig.singleQuote, true, './eslint-config/prettier: must match the Biome quote style');
assert.ok(
  prettierConfig.plugins.every(p => p.startsWith('/') || p.startsWith('file:')),
  './eslint-config/prettier: plugins must be absolute paths, see the note in eslint-config/prettier.js',
);
console.log(`ok  ./eslint-config/prettier       ${Object.keys(prettierConfig).length} options`);

if (!hasNext) {
  console.log('--  ./eslint-config/next   skipped (optional peer `next` not installed)');
}

console.log('\nAll entry points load.');
