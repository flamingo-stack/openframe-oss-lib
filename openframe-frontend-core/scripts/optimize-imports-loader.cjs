/**
 * A build loader for a CONSUMER of this library: it rewrites
 *
 *   import { Button, cn } from '<package>/components/ui'
 *
 * to the modules that define those names,
 *
 *   import { Button } from '<package>/dist/components/ui/button.js'; import { cn } from '<package>/dist/utils/cn.js'
 *
 * using the map the library's build writes beside this file (`export-map.json`,
 * see `scripts/build-export-map.mjs` for why a server file must not import an
 * entry). Nothing in the consumer's source changes.
 *
 * Next.js (Turbopack), in `next.config`:
 *
 *   const lib = { loaders: [require.resolve('<package>/optimize-imports-loader')],
 *                 condition: { all: [{ not: 'foreign' }, { content: /<package name>/ }] } }
 *   turbopack: { rules: { '*.ts': lib, '*.tsx': lib } }
 *
 * It is a webpack loader (source in, source out), so webpack takes it as a rule too.
 *
 * What it touches: `import { … } from` and `export { … } from` an entry of the
 * package. A name the map does not hold (a type, a name it could not trace)
 * stays in an import of the entry, written as a type import when every name
 * left is marked `type`. Default, namespace and `import type` statements, and
 * every other package, are left exactly as they are. The statement keeps its
 * line count, so a stack trace still points at the right line.
 */
const { readFileSync } = require('node:fs');
const { join } = require('node:path');

/** The rewrite for one export map (`{ package, entries }`): source in, source out. */
function createOptimizer(MAP) {
  const escaped = MAP.package.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&');
  const STATEMENT = new RegExp(
    `(^|\\n)([ \\t]*)(import|export)(\\s+type)?\\s*\\{([^}]*)\\}\\s*from\\s*(['"])(${escaped}(?:/[^'"]*)?)\\6[ \\t]*;?`,
    'g',
  );

  return function optimizeImports(source) {
    if (!source.includes(MAP.package)) return source;
    return source.replace(STATEMENT, (statement, lead, indent, keyword, typeOnly, list, quote, specifier) => {
      if (typeOnly) return statement;
      const entry = MAP.entries[`.${specifier.slice(MAP.package.length)}`];
      if (!entry) return statement;
      const byModule = new Map();
      const kept = [];
      for (const part of list.split(',')) {
        const text = part.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '').trim();
        if (!text) continue;
        const [name, alias] = text.split(/\s+as\s+/).map(piece => piece.trim());
        const defined =
          !name.startsWith('type ') && Object.prototype.hasOwnProperty.call(entry, name) ? entry[name] : null;
        if (!defined) {
          kept.push(text);
          continue;
        }
        const [file, exported] = defined;
        const local = alias ?? name;
        if (!byModule.has(file)) byModule.set(file, []);
        byModule.get(file).push(exported === local ? exported : `${exported} as ${local}`);
      }
      if (byModule.size === 0) return statement;
      const statements = [...byModule].map(
        ([file, names]) => `${keyword} { ${names.join(', ')} } from ${quote}${MAP.package}/${file}${quote};`,
      );
      if (kept.length > 0) {
        const allTypes = kept.every(text => text.startsWith('type '));
        const names = allTypes ? kept.map(text => text.slice(5).trim()) : kept;
        statements.push(
          `${keyword}${allTypes ? ' type' : ''} { ${names.join(', ')} } from ${quote}${specifier}${quote};`,
        );
      }
      // One line, then the newlines the statement had: every later line keeps its number.
      const lines = statement.slice(lead.length).split('\n').length - 1;
      return `${lead}${indent}${statements.join(' ')}${'\n'.repeat(lines)}`;
    });
  };
}

let optimize = null;

module.exports = function optimizeImportsLoader(source) {
  // The map the library's build wrote beside this file, read once per process.
  optimize ??= createOptimizer(JSON.parse(readFileSync(join(__dirname, 'export-map.json'), 'utf8')));
  return optimize(source);
};
module.exports.createOptimizer = createOptimizer;
