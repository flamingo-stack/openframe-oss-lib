/**
 * A Radix popup portals into the active portal container
 * (`usePortalContainer()`), never straight to <body>: a surface that owns its
 * overlays (ModalV2's `z-[1300]` layer, the chat panel) publishes one, and a
 * popup that skips it opens underneath that surface. Dialogs and sheets are
 * window layers themselves and are not checked.
 */

const POPUP_PACKAGE = /^@radix-ui\/react-(context-menu|dropdown-menu|hover-card|menubar|popover|select|tooltip)$/;

/** @type {import('eslint').Rule.RuleModule} */
const popupPortalContainer = {
  meta: {
    type: 'problem',
    docs: { description: 'Require a Radix popup Portal to portal into the active portal container' },
    schema: [],
    messages: {
      missing:
        '`{{name}}.Portal` without `container` portals to <body> and opens under a modal or panel that published ' +
        'a portal host: pass `container={usePortalContainer() ?? undefined}`.',
      escaped: '`{{name}}` handed out as a value escapes this check: wrap it in a component that passes `container`.',
    },
  },
  create(context) {
    const namespaces = new Set();
    return {
      ImportDeclaration(node) {
        if (!POPUP_PACKAGE.test(String(node.source.value))) return;
        for (const specifier of node.specifiers) {
          if (specifier.type === 'ImportNamespaceSpecifier') namespaces.add(specifier.local.name);
          else if (specifier.type === 'ImportSpecifier' && specifier.imported.name === 'Portal') {
            context.report({ node: specifier, messageId: 'escaped', data: { name: specifier.local.name } });
          }
        }
      },
      JSXOpeningElement(node) {
        const { name } = node;
        if (
          name.type !== 'JSXMemberExpression' ||
          name.object.type !== 'JSXIdentifier' ||
          !namespaces.has(name.object.name) ||
          name.property.name !== 'Portal'
        ) {
          return;
        }
        if (!node.attributes.some(attr => attr.type === 'JSXAttribute' && attr.name.name === 'container')) {
          context.report({ node, messageId: 'missing', data: { name: name.object.name } });
        }
      },
      MemberExpression(node) {
        if (
          node.object.type === 'Identifier' &&
          namespaces.has(node.object.name) &&
          !node.computed &&
          node.property.type === 'Identifier' &&
          node.property.name === 'Portal'
        ) {
          context.report({ node, messageId: 'escaped', data: { name: `${node.object.name}.Portal` } });
        }
      },
    };
  },
};

export const popupPortalPlugin = {
  meta: { name: 'flamingo-popup-portal' },
  rules: { 'popup-portal-container': popupPortalContainer },
};
