/**
 * A link is followed in ONE way: the lib's navigation executor (`executeNavigation`, `executeNavigationImperative`,
 * `executeNewTabNavigation`, the hooks built on it), which hands a same-tab link to the host's `runtime.navigation.navigate` and lets the browser
 * open what the host does not take. Nothing beside it navigates: no fallback option handed to it, and no router push or
 * `location` write in the same function as a call to it. A second path is how a host's routing gets skipped quietly
 * (CU-17tkuw61kfy: every caller passed `fallbackNavigate: router.push`). If a host does not navigate, wire its
 * `navigate`; never route around it.
 */

/** The executor and the hooks that call it. */
const EXECUTORS = new Set([
  'executeNavigation',
  'executeNavigationImperative',
  'executeNewTabNavigation',
  'handleChatNavClick',
  'useNavLinkViaRuntime',
  'useNavigateViaRuntime',
]);

/** `router.push(...)`, `router.replace(...)`: a router call on anything named like a router. */
const ROUTER_METHOD = new Set(['push', 'replace']);
const LOCATION_METHOD = new Set(['assign', 'replace']);

function calleeName(callee) {
  if (callee.type === 'Identifier') return callee.name;
  if (callee.type === 'MemberExpression' && !callee.computed && callee.property.type === 'Identifier') {
    return callee.property.name;
  }
  return null;
}

function objectName(node) {
  if (node.type === 'Identifier') return node.name;
  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name;
  }
  if (node.type === 'CallExpression') return calleeName(node.callee);
  return null;
}

/** A direct navigation: `router.push(x)`, `location.assign(x)`, `window.open(x)`, or a `location.href =` write. */
function directNavigation(node) {
  if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && !node.callee.computed) {
    const method = node.callee.property.name;
    const owner = objectName(node.callee.object);
    if (!owner) return null;
    if (ROUTER_METHOD.has(method) && /router$/i.test(owner)) return `${owner}.${method}()`;
    if (LOCATION_METHOD.has(method) && owner === 'location') return `location.${method}()`;
    if (method === 'open' && owner === 'window') return 'window.open()';
  }
  if (
    node.type === 'AssignmentExpression' &&
    node.left.type === 'MemberExpression' &&
    !node.left.computed &&
    node.left.property.name === 'href' &&
    objectName(node.left.object) === 'location'
  ) {
    return 'location.href =';
  }
  return null;
}

const FUNCTION_TYPES = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

/** @type {import('eslint').Rule.RuleModule} */
const noNavigationFallback = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow a second way to navigate beside the lib navigation executor' },
    schema: [],
    messages: {
      option:
        "`{{key}}` hands {{executor}} a second way to navigate. Links go through the host's " +
        '`runtime.navigation.navigate`; a host that does not navigate wires `navigate`, never a fallback.',
      beside:
        '{{call}} navigates beside {{executor}} in the same function. Follow a link through the executor only; a ' +
        'host that does not navigate wires `runtime.navigation.navigate`.',
    },
  },
  create(context) {
    // The module that DEFINES the executor is where navigating is implemented; the rule guards its callers.
    const definesExecutor = context.sourceCode.ast.body.some(statement => {
      const declaration = statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement;
      return declaration?.type === 'FunctionDeclaration' && EXECUTORS.has(declaration.id?.name);
    });
    if (definesExecutor) return {};
    /** Per enclosing function: the executor calls and the direct navigations anywhere inside it (nested handlers
     *  included). The file itself is a frame too, but only for its top-level code: two components in one file are
     *  two functions. */
    const frames = [];
    const reported = new Set();
    const enter = () => frames.push({ executors: [], direct: [] });
    const exit = () => {
      const frame = frames.pop();
      if (!frame || frame.executors.length === 0) return;
      for (const { node, call } of frame.direct) {
        if (reported.has(node)) continue;
        reported.add(node);
        context.report({ node, messageId: 'beside', data: { call, executor: frame.executors[0] } });
      }
    };
    /** The frames a fact belongs to: every enclosing function, or the file when at the top level. */
    const owners = () => (frames.length > 1 ? frames.slice(1) : frames);
    const noteDirect = node => {
      const call = directNavigation(node);
      if (call) for (const frame of owners()) frame.direct.push({ node, call });
    };

    return {
      Program: enter,
      'Program:exit': exit,
      ...Object.fromEntries(
        [...FUNCTION_TYPES].flatMap(t => [
          [t, enter],
          [`${t}:exit`, exit],
        ]),
      ),
      CallExpression(node) {
        const name = calleeName(node.callee);
        if (name && EXECUTORS.has(name)) {
          for (const frame of owners()) frame.executors.push(name);
          for (const arg of node.arguments) {
            if (arg.type !== 'ObjectExpression') continue;
            for (const prop of arg.properties) {
              const key = prop.type === 'Property' && !prop.computed ? (prop.key.name ?? prop.key.value) : null;
              if (typeof key === 'string' && /^fallback/i.test(key)) {
                context.report({ node: prop, messageId: 'option', data: { key, executor: name } });
              }
            }
          }
          if (name === 'handleChatNavClick' && node.arguments.length > 3) {
            context.report({
              node: node.arguments[3],
              messageId: 'option',
              data: { key: 'the fourth argument', executor: name },
            });
          }
          return;
        }
        noteDirect(node);
      },
      AssignmentExpression: noteDirect,
    };
  },
};

export const navigationPlugin = {
  meta: { name: 'flamingo-navigation' },
  rules: { 'no-navigation-fallback': noNavigationFallback },
};
