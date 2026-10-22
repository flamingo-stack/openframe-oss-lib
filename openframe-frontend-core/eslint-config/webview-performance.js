/**
 * Rules for render-path patterns that cost little in Chrome and a lot in
 * WebKit (Safari, and the WKWebView the desktop and iOS shells run in). Each
 * one was measured on the Mingo chat in 2026-10 (openframe-oss-lib#2513); the
 * numbers are in the rule messages so a finding explains itself.
 */

/** A `<style>` element in JSX: its text is replaced whenever React re-renders
 *  it, and every replacement makes WebKit restyle and relayout the document. */
const noInlineStyleElement = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow <style> elements rendered from components' },
    schema: [],
    messages: {
      inlineStyle:
        'Do not render a <style> element: React rewrites it on re-render and each rewrite makes WebKit ' +
        'restyle and relayout the whole document (Mingo streaming: 15ms -> 1ms per chunk once removed). ' +
        'Put keyframes in the Tailwind preset and other CSS in a stylesheet.',
    },
  },
  create(context) {
    return {
      JSXOpeningElement(node) {
        if (node.name.type === 'JSXIdentifier' && node.name.name === 'style') {
          context.report({ node, messageId: 'inlineStyle' });
        }
      },
    };
  },
};

/** zustand-style store hooks are `use<Name>Store`. */
const STORE_HOOK = /^use[A-Z]\w*Store$/;

/** `useXStore()` / `useXStore(s => s)`: the component re-renders on every
 *  write to any field of the store, not just the ones it reads. */
const noWholeStoreSubscription = {
  meta: {
    type: 'problem',
    docs: { description: 'Require a selector when subscribing to a store hook' },
    schema: [],
    messages: {
      wholeStore:
        '{{name}} without a field selector subscribes to the whole store, so every write to any field re-renders this component ' +
        '(Mingo chat: 4 renders per streamed frame -> 1 with selectors). Select the fields you read: ' +
        '{{name}}(s => s.field), or useShallow(s => ({ ... })) for several.',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (node.callee.type !== 'Identifier' || !STORE_HOOK.test(node.callee.name)) return;
        const [selector] = node.arguments;
        const identity =
          selector?.type === 'ArrowFunctionExpression' &&
          selector.params.length === 1 &&
          selector.params[0].type === 'Identifier' &&
          selector.body.type === 'Identifier' &&
          selector.body.name === selector.params[0].name;
        if (!selector || identity) {
          context.report({ node, messageId: 'wholeStore', data: { name: node.callee.name } });
        }
      },
    };
  },
};

export const webviewPerformancePlugin = {
  meta: { name: 'flamingo-webview-performance' },
  rules: {
    'no-inline-style-element': noInlineStyleElement,
    'no-whole-store-subscription': noWholeStoreSubscription,
  },
};
