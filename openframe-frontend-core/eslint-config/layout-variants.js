/**
 * An element lays out by the window (`md:`) or by the content area
 * (`content-md:`), never both. See "Content area breakpoints" in
 * src/ODS_TOKEN_RULES.md.
 */

const VIEWPORT = /^(?:max-)?(?:sm|md|lg|xl|2xl)$/;
const CONTENT = /^content-(?:max-)?(?:sm|md|lg|xl|2xl)$/;

/** The first class of each kind in a class string. A class that stacks the two
 *  (`md:content-max-md:flex`) is the deliberate form and counts as neither. */
function layoutVariantsIn(classes) {
  const found = {};
  for (const token of classes.split(/\s+/)) {
    const variants = token.split(':').slice(0, -1);
    const viewport = variants.some(variant => VIEWPORT.test(variant));
    const content = variants.some(variant => CONTENT.test(variant));
    if (viewport === content) continue;
    found[viewport ? 'viewport' : 'content'] ??= token;
  }
  return found;
}

/** @type {import('eslint').Rule.RuleModule} */
const noMixedLayoutVariants = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow viewport and content-area breakpoints in one class string' },
    schema: [],
    messages: {
      mixed:
        '`{{viewport}}` follows the window and `{{content}}` the content area. Tailwind emits every `content-*` ' +
        'rule before the viewport ones, so where they set the same property the viewport class wins at any ' +
        'content width. Use one of the two on an element; chrome that needs both stacks them in one class ' +
        '(`md:content-max-md:`).',
    },
  },
  create(context) {
    const check = (node, classes) => {
      const { viewport, content } = layoutVariantsIn(classes);
      if (viewport && content) context.report({ node, messageId: 'mixed', data: { viewport, content } });
    };
    return {
      Literal(node) {
        if (typeof node.value === 'string') check(node, node.value);
      },
      TemplateElement(node) {
        check(node, node.value.cooked ?? node.value.raw);
      },
    };
  },
};

export const layoutVariantsPlugin = {
  meta: { name: 'flamingo-layout-variants' },
  rules: { 'no-mixed-layout-variants': noMixedLayoutVariants },
};
