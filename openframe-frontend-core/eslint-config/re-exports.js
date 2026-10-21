/**
 * A module exports what it declares. Only a barrel (`index.ts` / `index.tsx`) collects other modules' exports.
 *
 * A re-export from an ordinary module (`export { X } from './y'`, or `import { X } from './y'; export { X };`) gives one
 * symbol a second address. Importers then reach it through whichever file they found first, the owner can no longer
 * tell who depends on it, and moving it means editing modules that never declared it. Import a symbol from the module
 * that declares it, or from the public barrel; never add a forwarding export.
 */

const isBarrel = filename => /(?:^|[\\/])index\.[cm]?[jt]sx?$/.test(filename);

/** @type {import('eslint').Rule.RuleModule} */
const noReExport = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow re-exports outside index barrels' },
    schema: [],
    messages: {
      reExport:
        '`{{name}}` is declared in another module. Import it from that module (or from the public barrel) where it is ' +
        'used; only an `index` barrel re-exports.',
    },
  },
  create(context) {
    if (isBarrel(context.filename)) return {};
    const imported = new Set();
    return {
      ImportDeclaration(node) {
        for (const specifier of node.specifiers) imported.add(specifier.local.name);
      },
      ExportAllDeclaration(node) {
        context.report({ node, messageId: 'reExport', data: { name: node.exported?.name ?? '*' } });
      },
      ExportNamedDeclaration(node) {
        if (node.declaration) return;
        for (const specifier of node.specifiers) {
          const local = specifier.local.type === 'Identifier' ? specifier.local.name : specifier.local.value;
          if (node.source || imported.has(local)) {
            const name = specifier.exported.type === 'Identifier' ? specifier.exported.name : specifier.exported.value;
            context.report({ node: specifier, messageId: 'reExport', data: { name } });
          }
        }
      },
      ExportDefaultDeclaration(node) {
        if (node.declaration.type === 'Identifier' && imported.has(node.declaration.name)) {
          context.report({ node, messageId: 'reExport', data: { name: node.declaration.name } });
        }
      },
    };
  },
};

export const reExportsPlugin = {
  meta: { name: 'flamingo-re-exports' },
  rules: { 'no-re-export': noReExport },
};
