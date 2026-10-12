/**
 * A link is the library's boxed `Link` (`embed-shims/next-link`), never a raw
 * `<a>`: the boxed one is the host's router link where a host registered one
 * (client navigation, prefetch) and a plain anchor everywhere else, so one
 * component is right in every host. The picture half of the same rule is
 * `@next/next/no-img-element` (the boxed `Image`, `embed-shims/next-image`).
 */

/** @type {import('eslint').Rule.RuleModule} */
const noRawAnchor = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow a raw <a>: links are drawn by the boxed Link' },
    schema: [],
    messages: {
      raw:
        'A raw `<a>` skips the host router: use the boxed `Link` (`embed-shims/next-link`), which is the ' +
        "host's own link where one is registered and a plain anchor everywhere else.",
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'a') context.report({ node, messageId: 'raw' });
      },
    };
  },
};

export const boxedPrimitivesPlugin = {
  meta: { name: 'flamingo-boxed-primitives' },
  rules: { 'no-raw-anchor': noRawAnchor },
};
