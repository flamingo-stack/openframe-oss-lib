/**
 * A class that styles nothing is an error. See "Dead classes" in ./README.md.
 *
 * Tailwind writes no rule for a class it does not know, and says nothing about it: `bg-ods-background`
 * (the token is `bg-ods-bg`), `text-body-sm`, `prose` (no typography plugin), `md:w-full!` (the
 * `!` goes first) and `duration-[180ms]` (ambiguous beside tailwindcss-animate's own `duration-*`) all
 * reached production that way, each one a style the author meant and no visitor ever got.
 *
 * The rule asks Tailwind itself, with the ODS preset (`../tailwind.config.ts`, the whole theme of every
 * app that uses this config), whether it knows each class in a class string (`getClassOrder`, the
 * lookup the official Prettier plugin sorts with). A class Tailwind does not know is still fine when a
 * stylesheet defines it: this package's own (`../src/styles`) and the app's, named by the `css` option.
 *
 * Only class strings are read: a `className` / `class` attribute, the arguments of `cn`, `clsx`, `cva`,
 * `twMerge`, `twJoin` and `classNames`, and a variable or property whose name ends in `class`,
 * `className` or `classes`. Only a token shaped like a Tailwind utility is judged, so a hook class
 * (`simple-markdown-renderer`) or a word in a cva key is never reported.
 *
 * Options: `{ css: ['app/globals.css'], allow: ['m-btn'] }`. `css` are files or directories relative to
 * the working directory whose `.class` selectors count as defined; `allow` names classes defined
 * somewhere a file cannot be read from (an email's inline `<style>`).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PRESET = join(HERE, '..', 'tailwind.config.ts');
const OWN_CSS = join(HERE, '..', 'src', 'styles');

/** Calls whose string arguments are class lists. */
const CLASS_CALLS = new Set(['cn', 'clsx', 'cva', 'twMerge', 'twJoin', 'classNames', 'classnames']);
const CLASS_ATTRIBUTES = new Set(['className', 'class']);
const CLASS_BINDING =
  /(?:^|_|[a-z])(?:[cC]lass(?:[nN]ame)?(?:es)?|CLASS(?:_?NAME)?(?:ES)?)$|^[a-z]\w*(?:Class|ClassName)$/;

/** The utility families Tailwind and the ODS preset generate. A token outside them is a hook, not a utility. */
const UTILITY =
  /^(?:bg|text|border|ring|fill|stroke|shadow|outline|p[xytrbl]?|m[xytrbl]?|w|h|size|min-w|max-w|min-h|max-h|gap|space-[xy]|inset(?:-[xy])?|top|left|right|bottom|start|end|z|order|grid|col|row|flex|basis|grow|shrink|items|justify|content|self|place|font|leading|tracking|line-clamp|rounded|opacity|duration|ease|delay|transition|animate|translate-[xyz]|scale(?:-[xy])?|rotate|skew-[xy]|origin|cursor|select|overflow|overscroll|whitespace|break|truncate|list|decoration|underline|object|aspect|columns|divide|backdrop|blur|brightness|contrast|drop-shadow|grayscale|invert|saturate|sepia|filter|mix-blend|bg-blend|from|via|to|prose|align|appearance|accent|caret|scroll|snap|touch|will-change|visible|invisible|static|fixed|absolute|relative|sticky|block|inline|hidden|table|contents|float|clear|box|indent|hyphens|tabular)(?:-|$)/;
/** An arbitrary duration, easing or delay: tailwindcss-animate defines the same names, so Tailwind writes neither. */
const AMBIGUOUS = /^(?:duration|ease|delay)-\[/;

let tailwind;
/** One Tailwind context for the preset, built on first use and kept for the process. */
function knownClasses(classes) {
  if (!tailwind) {
    const requireTailwind = createRequire(join(process.cwd(), 'package.json'));
    const fromHere = createRequire(import.meta.url);
    const load = id => {
      try {
        return requireTailwind(id);
      } catch {
        return fromHere(id);
      }
    };
    const loadConfig = load('tailwindcss/loadConfig');
    const resolveConfig = load('tailwindcss/resolveConfig');
    const { createContext } = load('tailwindcss/lib/lib/setupContextUtils');
    const preset = loadConfig(PRESET);
    tailwind = createContext(resolveConfig({ presets: [preset.default ?? preset], content: [] }));
  }
  // Tailwind prints its own "ambiguous class" warning to the console; this rule reports it instead.
  const warn = console.warn;
  console.warn = () => {};
  try {
    return new Map(tailwind.getClassOrder(classes));
  } finally {
    console.warn = warn;
  }
}

const cssClasses = new Map();
/** The class names the `.class` selectors of the CSS files under `paths` define. */
function definedInCss(paths) {
  const key = paths.join('\n');
  if (!cssClasses.has(key)) {
    const names = new Set();
    const read = path => {
      if (!existsSync(path)) return;
      if (statSync(path).isDirectory()) {
        for (const entry of readdirSync(path)) read(join(path, entry));
        return;
      }
      if (!path.endsWith('.css')) return;
      const text = readFileSync(path, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      for (const match of text.matchAll(/\.(-?[_a-zA-Z][\w-]*(?:\\.[\w-]*)*)/g)) names.add(match[1].replace(/\\/g, ''));
    };
    for (const path of paths) read(path);
    cssClasses.set(key, names);
  }
  return cssClasses.get(key);
}

/** The utility a token applies, without its variants (`md:`, `[&_svg]:`), `!` and `-`. */
function utilityOf(token) {
  let depth = 0;
  let last = -1;
  for (let i = 0; i < token.length; i++) {
    const char = token[i];
    if (char === '[') depth++;
    else if (char === ']') depth--;
    else if (char === ':' && depth === 0) last = i;
  }
  return token.slice(last + 1).replace(/^!?-?/, '');
}

/** Is this node where a class string is expected? */
function isClassContext(node) {
  if (node.type === 'JSXAttribute') return CLASS_ATTRIBUTES.has(node.name?.name);
  if (node.type === 'CallExpression') {
    const callee = node.callee.type === 'MemberExpression' ? node.callee.property : node.callee;
    return callee?.type === 'Identifier' && CLASS_CALLS.has(callee.name);
  }
  if (node.type === 'VariableDeclarator') return node.id.type === 'Identifier' && CLASS_BINDING.test(node.id.name);
  if (node.type === 'AssignmentPattern') return node.left.type === 'Identifier' && CLASS_BINDING.test(node.left.name);
  if (node.type === 'Property') {
    const name = node.key?.type === 'Identifier' ? node.key.name : node.key?.value;
    return typeof name === 'string' && CLASS_BINDING.test(name);
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const noDeadClass = {
  meta: {
    type: 'problem',
    docs: { description: 'Disallow class names that no Tailwind utility and no stylesheet defines' },
    schema: [
      {
        type: 'object',
        properties: {
          css: { type: 'array', items: { type: 'string' } },
          allow: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      dead:
        '`{{token}}` styles nothing: Tailwind with the ODS preset has no utility by that name and no stylesheet ' +
        'defines it, so it is dropped without a warning. Use an ODS token (src/ODS_TOKEN_RULES.md) or delete it.',
      ambiguous:
        '`{{token}}` styles nothing: tailwindcss-animate defines `{{family}}-*` too, so Tailwind writes neither ' +
        'rule. Write the property itself: `[{{property}}:{{value}}]`.',
    },
  },
  create(context) {
    const { css = [], allow = [] } = context.options[0] ?? {};
    const allowed = new Set(allow);
    const defined = definedInCss([OWN_CSS, ...css.map(path => resolve(process.cwd(), path))]);

    const check = (node, text, { openStart, openEnd }) => {
      const tokens = text.split(/\s+/);
      if (openStart) tokens.shift();
      if (openEnd) tokens.pop();
      const candidates = tokens.filter(token => token && !allowed.has(token) && UTILITY.test(utilityOf(token)));
      if (candidates.length === 0) return;
      const known = knownClasses(candidates);
      for (const token of candidates) {
        if (known.get(token) !== null || defined.has(token) || defined.has(utilityOf(token))) continue;
        const utility = utilityOf(token);
        if (AMBIGUOUS.test(utility)) {
          const family = utility.slice(0, utility.indexOf('-'));
          const property = {
            duration: 'transition-duration',
            ease: 'transition-timing-function',
            delay: 'transition-delay',
          }[family];
          const value = utility.slice(utility.indexOf('[') + 1, utility.lastIndexOf(']'));
          context.report({ node, messageId: 'ambiguous', data: { token, family, property, value } });
        } else {
          context.report({ node, messageId: 'dead', data: { token } });
        }
      }
    };

    /** Every string literal and template part under a class context, once each. */
    const seen = new WeakSet();
    const visit = node => {
      if (!node || typeof node.type !== 'string' || seen.has(node)) return;
      seen.add(node);
      if (node.type === 'Literal' && typeof node.value === 'string') {
        // A value compared or switched on (`side === 'right' && 'right-0'`) is a value, not a class; so is a
        // lone word (a variant name such as `'accent'`): a class list that is one bare word is a utility
        // Tailwind knows (`'hidden'`) or not a class at all.
        const parent = node.parent;
        if ((parent?.type === 'BinaryExpression' && parent.operator !== '+') || parent?.type === 'SwitchCase') return;
        if (/^[a-z]+$/.test(node.value.trim())) return;
        check(node, node.value, {});
        return;
      }
      // An index (`ALIGN_CLASS[align ?? 'left']`) names an entry, not a class.
      if (node.type === 'MemberExpression') {
        visit(node.object);
        return;
      }
      // cva: `defaultVariants` names variants; a `compoundVariants` entry names variants beside its `class`.
      if (node.type === 'Property') {
        const key = node.key?.type === 'Identifier' ? node.key.name : node.key?.value;
        if (key === 'defaultVariants') return;
        if (key === 'compoundVariants' && node.value.type === 'ArrayExpression') {
          for (const entry of node.value.elements) {
            if (entry?.type !== 'ObjectExpression') continue;
            for (const property of entry.properties) {
              const name = property.key?.type === 'Identifier' ? property.key.name : property.key?.value;
              if (name === 'class' || name === 'className') visit(property.value);
            }
          }
          return;
        }
        visit(node.value);
        return;
      }
      if (node.type === 'TemplateLiteral') {
        node.quasis.forEach((quasi, index) => {
          check(quasi, quasi.value.cooked ?? quasi.value.raw, {
            openStart: index > 0 && !/^\s/.test(quasi.value.raw),
            openEnd: !quasi.tail && !/\s$/.test(quasi.value.raw),
          });
        });
        node.expressions.forEach(visit);
        return;
      }
      // A nested function is behaviour, not a class list (an event handler inside a cn() call's arguments).
      if (/Function/.test(node.type)) return;
      for (const key of Object.keys(node)) {
        if (key === 'parent' || key === 'loc' || key === 'range') continue;
        const value = node[key];
        if (Array.isArray(value)) value.forEach(visit);
        else if (value && typeof value.type === 'string') visit(value);
      }
    };

    const enter = node => {
      if (!isClassContext(node)) return;
      if (node.type === 'JSXAttribute') visit(node.value);
      else if (node.type === 'CallExpression') node.arguments.forEach(visit);
      else if (node.type === 'VariableDeclarator') visit(node.init);
      else if (node.type === 'AssignmentPattern') visit(node.right);
      else visit(node.value);
    };
    return {
      JSXAttribute: enter,
      CallExpression: enter,
      VariableDeclarator: enter,
      Property: enter,
      AssignmentPattern: enter,
    };
  },
};

export const deadClassesPlugin = {
  meta: { name: 'flamingo-dead-classes' },
  rules: { 'no-dead-class': noDeadClass },
};
