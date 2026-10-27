/**
 * A picture's size comes from the image-size table (src/styles/image-sizes.ts), never from the component: every
 * `sizes`, width ladder and quality a component picks on its own is another copy the image host makes and caches.
 * The rule fails on a string-literal `sizes` and on any `quality` on an `<Image>`.
 */

/** A string the attribute states outright: `"..."`, `{'...'}` or a template with no expressions. */
function isLiteralString(value) {
  if (!value) return false;
  if (value.type === 'Literal') return typeof value.value === 'string';
  if (value.type !== 'JSXExpressionContainer') return false;
  const { expression } = value;
  if (expression.type === 'Literal') return typeof expression.value === 'string';
  return expression.type === 'TemplateLiteral' && expression.expressions.length === 0;
}

/** @type {import('eslint').Rule.RuleModule} */
const noAdHocImageSize = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow picture sizes and qualities that do not come from the image-size table' },
    schema: [],
    messages: {
      sizes:
        "`sizes` on an `<Image>` is a slot of the image-size table (`IMAGE_SLOT.card`, `fixedImageSlot('tile')`), " +
        'never a string: every distinct value is another cached copy at the image host.',
      quality:
        '`quality` on an `<Image>`: one quality comes from the host (`IMAGE_QUALITY`). A second quality is a second ' +
        'copy of every picture.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'Image') return;
        for (const attribute of node.attributes) {
          if (attribute.type !== 'JSXAttribute' || attribute.name.type !== 'JSXIdentifier') continue;
          const { name } = attribute.name;
          if (name === 'quality') context.report({ node: attribute, messageId: 'quality' });
          else if (name === 'sizes' && isLiteralString(attribute.value))
            context.report({ node: attribute, messageId: 'sizes' });
        }
      },
    };
  },
};

export const imageSizesPlugin = {
  meta: { name: 'flamingo-image-sizes' },
  rules: { 'no-ad-hoc-image-size': noAdHocImageSize },
};
