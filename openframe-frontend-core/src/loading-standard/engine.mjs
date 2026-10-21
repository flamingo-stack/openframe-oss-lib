/**
 * THE loading-standard rule engine: one AST reading (the TypeScript compiler API) of the loading standard, shipped in
 * the lib (`src/loading-standard/engine.mjs`, plain ESM so a host's script imports it by file path from its installed
 * copy) and used by the lib's own test (`src/__tests__/loading-standard.test.ts`) and by every host's gate
 * (openframe-frontend's `scripts/check-page-skeletons.mjs` and `scripts/check-skeleton-full-page.mjs`).
 *
 * Every rule reads COMPONENTS (a function body), never lines: imports, `as` renames, local aliases
 * (`const X = YSkeleton`), namespace imports and `createElement(Y)` resolve to the name they stand for, and a
 * condition is read as an expression however many lines it spans. A finding names its rule, its file and its line.
 *
 * THE RULES (ids as reported; `RULES` below holds the one-line reason of each):
 *
 * ONE_SWITCH            `<YSkeleton>` (or an alias of it, or `createElement(YSkeleton)`, or `{YSkeleton}` handed to a
 *                       prop) rendered outside Y's module (the file declaring Y or YSkeleton), when Y switches itself
 *                       (its function calls the loading scope). Render `<Y />`: it draws its own skeleton. A `*Skeleton`
 *                       function may compose a child's skeleton, unless its module renders `<Y />` elsewhere (then the
 *                       skeleton renders `<Y />` too: one structure).
 * NO_SCOPE_SWITCH       The same render where Y never switches itself: Y should draw its own skeleton on the scope.
 * PROP_ONLY_SWITCH      A component that returns a skeleton on a boolean of its own (a prop, `props.x`, a local made
 *                       from them) and never calls the loading scope in THAT component: inside a scope it draws the
 *                       loaded form with no data. Its one switch is `useLoadingScope() || loading`. A boolean read from
 *                       a hook (a table's context, a query) is the hook's switch and not counted.
 * NOTHING_WHILE_LOADING `if (loading) return null`, `loading ? null : <X />`, `!loading ? <X /> : null`,
 *                       `{!loading && <X />}` in a component that does not switch, and the same keyed on read data that
 *                       is missing before the read answers (`!data`, `!data?.items`, `data ? <X /> : null`): the slot is
 *                       empty while it loads. Exempt once the read has answered in that component (a suspending read,
 *                       a loading branch or the scope above it), inside a list's per-item callback, a scope `return
 *                       null` whose loaded return is marked `data-loading-optional` or is a Relay reader
 *                       (`<XQuery />`), and a flag that is an ACTION's progress (handed to a `*Button`'s `loading` or
 *                       `disabled` in the same component). A local holding the scope (`const scoped =
 *                       useLoadingScope()`) is a loading flag.
 * SPINNER               `animate-spin` anywhere but on an action's progress icon (`Loader2`, `RefreshCw`), and a
 *                       progress icon keyed on a READ flag (`isLoading`, `isFetching`, a hook's `loading`) or returned
 *                       as a component's whole output.
 * LOADER_COMPONENT      A loader as a loading state (`PageLoader`, `CompactPageLoader`, `ContentLoader`, `CardLoader`,
 *                       `DetailLoader`, `FormLoader`, `ListLoader`, `ChatCardLoader`, `OpenmspHeartbeatLoader`,
 *                       `Spinner`).
 * LOADING_TEXT          "Loading"/"Checking" as a text node, as a string rendered in JSX, as a placeholder, or as a
 *                       "Loading…" string (labels, `aria-label` and `title` are announcements, not text).
 * OWN_PULSE             A pulse or skeleton colour of one's own (`animate-pulse`, `animate-[pulse…`, `bg-ods-skeleton`,
 *                       `animation-duration`): one pulse, the lib's.
 * SUSPENSE_FALLBACK     A `Suspense` / `React.Suspense` with no fallback, or a fallback of `null`, `undefined`, an
 *                       empty fragment or an empty string.
 * HAND_PAIR             A hand-built `<Suspense fallback={<LoadingFallback>…}>` (use `LoadingSuspense`), or a hand
 *                       `<LoadingRegion>` around a `<LoadingScope>` (use `LoadingFallback`).
 * WHOLE_VIEW_SKELETON   A component declared `*PageSkeleton`, `*ScreenSkeleton`, `*DetailSkeleton`, `*ArticleSkeleton`,
 *                       `*ViewSkeleton`, `*HomeSkeleton`, `*DeckSkeleton`, `*EditorSkeleton`, `*CenterSkeleton`,
 *                       `*CatalogSkeleton`, `*FormSkeleton`, `*LayoutSkeleton` or `*LoadingLayout`, and any render of
 *                       `DetailPageSkeleton` (a declaration marked `@deprecated` is a kept alias and not counted).
 * FOLD_PROP             A `fold` prop on any element (a skeleton draws its full count: `skeletonCount`).
 * DEPRECATED_SKELETON   A render of a skeleton the lib marks `@deprecated` (read from the lib's source).
 * RETIRED_API           The retired first-paint memory, stand-in data (`standIn`, `Hold*`) and `StreamedPage`'s
 *                       `skeleton` / `memory` / `remember` props.
 * TYPED_COUNT           A count typed at the place that draws it: a literal (after resolving a constant to its
 *                       initializer) on a skeleton count prop (`skeletonRows`, `skeletonCount`, `loadingRows`, any
 *                       `(skeleton|loading|placeholder)…(Rows|Count|Lines|Items)`, `count` on `LoadingItems`, `rows` /
 *                       `count` / `lines` on a `*Skeleton` element), the length of a list drawn while loading
 *                       (`Array.from({ length })`, `Array(n)`, `[...Array(n)]`, `[0, 1, 2].map`), a literal default of a
 *                       count prop (`skeletonRows = 8`, `rows = 6` in a `*Skeleton`), a `?? 10` fallback in a count,
 *                       and a module constant holding a literal-length list used while loading.
 * COUNT_SOURCE          A skeleton count (`skeletonRows`, `skeletonCount`, `LoadingItems count`, a loading list's length)
 *                       that names neither a page size, a limit, `first`, nor a declared `*_SKELETON_*` constant (a
 *                       pass-through of the same name is checked where its caller names it).
 * COUNT_CAP             A count capped: `Math.min(pageSize, FOLD | CONSTANT | 8)`, a ternary or comparison cap
 *                       (`PAGE_SIZE > 6 ? 6 : PAGE_SIZE`), or a count named `*FOLD*`, `*VISIBLE*` or `*SCREEN*`.
 * HIDDEN_ITEMS          A loading item hidden per breakpoint (`hidden md:block`, `max-md:hidden`, `md:hidden` on the
 *                       item's own element, conditional classes included) or a container hiding items past the Nth
 *                       (`[&>*:nth-child(n+N)]:hidden`) while loading.
 * ITEM_MARK             A loading list (`LoadingItems`, or a list whose count is a page size, limit or `*_SKELETON_*`
 *                       constant) whose items are not marked `data-loading-item` (or `loadingItemProps(…)`, `listItem`,
 *                       `listItems` on the item element, or inside the item's component, found through its import),
 *                       and the loaded list beside it (the other branch of the same condition). The cells of one row
 *                       (a count named `columns`, `cols`, `cells`) are not list items.
 * OPTIONAL_MARK         In a component that switches on the scope, a part left out while loading (`{!loading && <X />}`)
 *                       or keyed on a read field (`{record.note && <X />}`, `{record?.x ? <X /> : null}`) that does not
 *                       carry `data-loading-optional`. Not counted: an error / offline state, the loaded half of an
 *                       explicit pair (a `{loading && …}` sibling before it), a flag-like field (`show…`, `is…`,
 *                       `has…`) or a configuration / presentation field (`actions.copy`, `anchorProps.href`, `icon`), an
 *                       empty-state notice (`noX`, `!hasX`, `length === 0`), a part inside a list's per-item callback,
 *                       a link of a ternary chain, a part with no room in the page (a modal, a popover's content, an
 *                       `sr-only` / `role="status"` announcement), and a part where the loading form draws its OWN
 *                       version of the region (after an early `if (loading) return …`, in the loaded half of
 *                       `loading ? <A /> : <B />`, or the `else` of an `if` on the loading state): only a part of the
 *                       one structure both forms share can be left out. A component that reads the scope but draws no
 *                       loading form (no skeleton, no `loading` handed down, no branch on the flag) is not switching.
 *
 * ALLOWED FORMS (no rule fires): a `next/dynamic` `loading: () => <YSkeleton />` fallback (inside the `dynamic(` call);
 * a registry entry's own `skeleton:` slot drawing the card its `render:` draws (`XChatCard` is X's card); an action's
 * progress icon; `return null` after a suspending read or a loading branch; error states; a ternary choosing between
 * two forms of one slot; pass-through counts; a safety-capped list drawing a declared `*_SKELETON_*` constant.
 *
 * OPT-OUT: `// loading-standard-ok: <why>` (any rule) or `// full-page-ok: <why>` (the count and mark rules) on the
 * finding's line or one of the two above it.
 *
 * CONFIG: `CONFIGS.lib` and `CONFIGS.frontend` hold each repository's rule set and exemptions, declared once here.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, relative, resolve } from 'node:path';

// The compiler is the HOST's (a dev dependency of every repository that runs the gate), resolved from where this
// module is installed: the lib does not ship TypeScript to its consumers.
const ts = createRequire(import.meta.url)('typescript');

/** Every rule id, with the reason a finding of it prints. */
export const RULES = {
  ONE_SWITCH: 'a parent picks the skeleton of a component that switches itself (render the component)',
  NO_SCOPE_SWITCH:
    'a parent picks the skeleton of a component that never switches itself (the component should switch on useLoadingScope())',
  PROP_ONLY_SWITCH: 'a switch on the loading prop alone (switch on useLoadingScope() || loading)',
  NOTHING_WHILE_LOADING: 'nothing drawn while loading (render the component in a loading scope)',
  SPINNER: 'a spinner as a loading state',
  LOADER_COMPONENT: 'a loader component as a loading state (render the components in a loading scope)',
  LOADING_TEXT: '"Loading" text as a loading state (draw the component skeleton)',
  OWN_PULSE: 'a pulse or skeleton colour of its own (use the lib skeletons)',
  SUSPENSE_FALLBACK: 'a Suspense with no fallback (use LoadingSuspense / LoadingFallback)',
  HAND_PAIR: 'a hand-built loading pair (use the lib wrapper)',
  WHOLE_VIEW_SKELETON: 'a whole-view skeleton (the view itself in a loading scope is its loading state)',
  FOLD_PROP: 'a `fold` prop (a skeleton draws its full count: skeletonCount)',
  DEPRECATED_SKELETON: 'deprecated in the lib (render the component in a loading scope)',
  RETIRED_API: 'a retired loading API',
  TYPED_COUNT: "a typed skeleton count (name the list's page size, limit or a *_SKELETON_* constant)",
  COUNT_SOURCE: 'a skeleton count that does not name a page size, a limit or a *_SKELETON_* constant',
  COUNT_CAP: "a page size or limit capped (a list's skeleton draws its full page)",
  HIDDEN_ITEMS: 'loading items hidden per breakpoint (a skeleton draws its full count at every width)',
  ITEM_MARK: 'a loading list with no data-loading-item (or loadingItemProps) on its items',
  OPTIONAL_MARK: 'a part left out while loading has no data-loading-optional',
};

export const PAGE_RULES = [
  'ONE_SWITCH',
  'NO_SCOPE_SWITCH',
  'PROP_ONLY_SWITCH',
  'NOTHING_WHILE_LOADING',
  'SPINNER',
  'LOADER_COMPONENT',
  'LOADING_TEXT',
  'OWN_PULSE',
  'SUSPENSE_FALLBACK',
  'HAND_PAIR',
  'WHOLE_VIEW_SKELETON',
  'FOLD_PROP',
  'DEPRECATED_SKELETON',
  'RETIRED_API',
];
export const COUNT_RULES = ['TYPED_COUNT', 'COUNT_SOURCE', 'COUNT_CAP', 'HIDDEN_ITEMS', 'ITEM_MARK', 'OPTIONAL_MARK'];
const COUNT_RULE_SET = new Set(COUNT_RULES);

/**
 * Each repository's rule set and exemptions. An exemption names the files (a RegExp over the path relative to the
 * tree's root) and the rules it lifts, and says why.
 */
export const CONFIGS = {
  frontend: { rules: [...PAGE_RULES, ...COUNT_RULES], exempt: [] },
  lib: {
    rules: [...PAGE_RULES, ...COUNT_RULES],
    exempt: [
      {
        why: 'the deprecated whole-view re-exports older hosts still import (each renders the components in a scope)',
        files:
          /(?:^|\/)(?:trust-center-page-skeleton|detail-page-skeleton|deprecated-layout-skeletons|margin-report-skeleton|category-vendor-selector-skeleton|settings-form-skeleton|msp-profile-form-skeleton|page-layout-skeleton)\.tsx$/,
        rules: [...PAGE_RULES, ...COUNT_RULES],
      },
      {
        why: "the lib's own loading primitives: the one pulse, the scope, the fallback and the Suspense wrapper are built here",
        files:
          /(?:^|\/)components\/(?:loading\/(?:loading-fallback|loading-region|unified-skeleton)|ui\/(?:loading-scope|skeleton[\w-]*|text-line-skeleton))\.tsx?$/,
        rules: ['OWN_PULSE', 'HAND_PAIR', 'SUSPENSE_FALLBACK', 'NOTHING_WHILE_LOADING'],
      },
      {
        why: 'the loaders themselves (declared, never used as a screen state in the lib)',
        files:
          /(?:^|\/)components\/(?:ui\/[\w-]*loader[\w-]*|loading\/openmsp-heartbeat|ui\/button\/button|chat\/entity-cards\/dispatch)\.tsx$/,
        rules: ['LOADER_COMPONENT', 'SPINNER', 'OWN_PULSE'],
      },
    ],
  },
};

// ---------------------------------------------------------------------------------------------------------------------
// Vocabulary
// ---------------------------------------------------------------------------------------------------------------------

const SCOPE_HOOK = 'useLoadingScope';
const LOADING_FLAG = /^(?:loading|isLoading|isFetching|isPending|pending|isRefetching|isInitialLoading|isLoadingMore)$/;
const READ_FLAG = /^(?:isLoading|isFetching|isRefetching|isInitialLoading|loading)$/;
const READ_DATA = /^(?:data|[a-z]\w*Data)$/;
const SWITCH_FLAG = /loading|pending|skeleton|busy|fetching|waiting/i;
const LOCAL_HOOK = /(?:^|\.)(?:useMemo|useState|useCallback|useRef|useReducer|useDeferredValue|useId|useTransition)$/;
const SUSPENDING_READ =
  /^(?:useLazyLoadQuery|usePreloadedQuery|useFragment|usePaginationFragment|useRefetchableFragment|useSuspenseQuery|useSuspenseQueries|use)$/;
const PROGRESS_ICONS = new Set(['Loader2', 'RefreshCw']);
const LOADERS = new Set([
  'PageLoader',
  'CompactPageLoader',
  'ContentLoader',
  'CardLoader',
  'DetailLoader',
  'FormLoader',
  'ListLoader',
  'ChatCardLoader',
  'OpenmspHeartbeatLoader',
  'Spinner',
]);
const WHOLE_VIEW =
  /^[A-Z]\w*(?:(?:Page|Screen|Detail|Article|View|Home|Deck|Editor|Center|Catalog|Form|Layout)Skeleton|LoadingLayout)$/;
const MEMORY = new Set([
  'pageFirstPaint',
  'firstPaintKvStore',
  'createFirstPaintMemory',
  'careersSeed',
  'refreshCareersSeed',
  'lastKnownHomeLayout',
  'rememberHomeLayout',
]);
const STAND_IN = new Set([
  'standIn',
  'isStandIn',
  'STAND_IN_MARK',
  'HoldStandIn',
  'HoldText',
  'HoldWords',
  'HoldBox',
  'useHolds',
  'HELD_CONTROL_CLASS',
]);
const COUNT_ATTR = /^(?:skeletonRows|skeletonCount|(?:skeleton|loading|placeholder)\w*(?:Rows|Count|Lines|Items))$/i;
const SOURCE_COUNT = /(?:PAGE_SIZE|LIMIT|(?:^|_)SKELETON_|^first$|pageSize|page_size|perPage|per_page|limit$|Limit$)/;
const LIST_COUNT = /(?:PAGE_SIZE|LIMIT|(?:^|_)SKELETON_|pageSize|page_size|perPage|limit$|Limit$|^first$)/;
const CAP_NAME = /fold|visible|screen/i;
const PAGE_ARG = /\b(?:page_?size|per_?page|cards_?per_?page|limit|[A-Z_]*_(?:PAGE_SIZE|LIMIT|MAX))\b/i;
const CAP_ARG = /fold|screen|\b[A-Z][A-Z0-9_]{2,}\b|^\d+$/;
const BREAKPOINT_HIDDEN =
  /(?:^|\s)(?:hidden\s+(?:[\w-]+:)+(?:block|flex|grid|inline|inline-flex|inline-block|table|table-row|table-cell|contents)|(?:[\w-]+:)+hidden)(?=\s|$)|(?:^|\s)(?:[\w-]+:)+(?:block|flex|grid|inline|inline-flex|table-row|table-cell|contents)\s+hidden(?=\s|$)/;
const NTH_HIDDEN = /nth-child\([^)]*\)\]:hidden/;
const FLAG_FIELD =
  /^(?:is|has|show|should|can|enable|hide|with|allow)(?=[A-Z]|$)|^(?:enabled|hidden|disabled|open|visible|selected|active|expanded|collapsed|checked|loading|length)$/;
const CONFIG_FIELD = /^(?:icon|children|actions?|className|style|href|on[A-Z]\w*|render[A-Z]?\w*)$/;
/** Roots that hold configuration or presentation, never a record (`actions.copy`, `anchorProps.href`). */
const CONFIG_ROOT =
  /^(?:props|this|window|document|process|config|settings|options|actions|theme|styles?|classes|t|i18n|router|navigation|form|field|meta|labels|copy|\w+Props)$/i;
const FAILURE = /error|offline|failed|failure/i;
const OPT_OUT_ANY = 'loading-standard-ok:';
const OPT_OUT_COUNT = 'full-page-ok:';
const WRAPPER_CALL = /^(?:memo|forwardRef|observer|React\.memo|React\.forwardRef)$|^with[A-Z]/;

// ---------------------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------------------

const SKIPPED_DIRS = new Set(['node_modules', '__tests__', '__fixtures__', 'stories']);
const TEST_FILE = /\.(?:test|stories|spec)\.tsx?$/;

/** Every `.ts` / `.tsx` file under `dir`, without dependencies, dot folders, tests and stories. */
export function* walkSourceFiles(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIPPED_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walkSourceFiles(full);
    else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name) && !TEST_FILE.test(entry.name)) yield full;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// AST helpers
// ---------------------------------------------------------------------------------------------------------------------

const isFunctionLike = node =>
  ts.isArrowFunction(node) ||
  ts.isFunctionExpression(node) ||
  ts.isFunctionDeclaration(node) ||
  ts.isMethodDeclaration(node);

function strip(node) {
  let n = node;
  while (
    n &&
    (ts.isParenthesizedExpression(n) ||
      ts.isAsExpression(n) ||
      ts.isNonNullExpression(n) ||
      (ts.isSatisfiesExpression && ts.isSatisfiesExpression(n)) ||
      ts.isTypeAssertionExpression(n))
  )
    n = n.expression;
  return n;
}

/** The text of a callee / tag (`A`, `A.B`). */
function dottedName(node) {
  const n = strip(node);
  if (!n) return '';
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) {
    const left = dottedName(n.expression);
    return left ? `${left}.${n.name.text}` : n.name.text;
  }
  if (n.kind === ts.SyntaxKind.ThisKeyword) return 'this';
  return '';
}

/** The name a function-like node is known by (its declaration, the variable or property it is assigned to). */
export function functionName(fn) {
  if ((ts.isFunctionDeclaration(fn) || ts.isFunctionExpression(fn)) && fn.name) return fn.name.text;
  if (ts.isMethodDeclaration(fn) && ts.isIdentifier(fn.name)) return fn.name.text;
  let p = fn.parent;
  while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;
  while (p && ts.isCallExpression(p) && WRAPPER_CALL.test(dottedName(p.expression))) {
    p = p.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p))) p = p.parent;
  }
  if (p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name)) return p.name.text;
  if (p && ts.isPropertyAssignment(p) && (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) return p.name.text;
  return '';
}

const isComponentName = name => /^[A-Z]/.test(name);

/** The nearest enclosing function-like node, or null. */
function nearestFunction(node) {
  for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p)) return p;
  return null;
}

/** The nearest enclosing function whose name is a component's (capitalised), else the outermost function, else null. */
function componentOf(node) {
  let outer = null;
  for (let p = node.parent; p; p = p.parent) {
    if (!isFunctionLike(p)) continue;
    if (isComponentName(functionName(p))) return p;
    outer = p;
  }
  return outer;
}

/** Every enclosing function's name, innermost first. */
function enclosingNames(node) {
  const names = [];
  for (let p = node.parent; p; p = p.parent) if (isFunctionLike(p)) names.push(functionName(p));
  return names;
}

/** Walk `node`'s descendants, calling `visit`; `visit` returning false skips the subtree. */
function walk(node, visit) {
  const go = n => {
    if (visit(n) === false) return;
    ts.forEachChild(n, go);
  };
  ts.forEachChild(node, go);
}

function bodyOf(fn) {
  return fn.body ?? null;
}

/** The JSX element a returned / arrow-body expression is (first JSX through parens, conditionals take the true side). */
function rootElement(expr) {
  const n = strip(expr);
  if (!n) return null;
  if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n)) return n;
  if (ts.isConditionalExpression(n)) return rootElement(n.whenTrue);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    return rootElement(n.right);
  return null;
}

/** The element (opening or self-closing) carrying the attributes of a JSX element node. */
function openingOf(el) {
  if (ts.isJsxElement(el)) return el.openingElement;
  if (ts.isJsxSelfClosingElement(el)) return el;
  return null;
}

/** The returned expression of a callback (an arrow's concise body, or its block's last `return`). */
function returnedExpression(fn) {
  if (!fn) return null;
  if (fn.body && !ts.isBlock(fn.body)) return fn.body;
  let found = null;
  if (fn.body)
    walk(fn.body, n => {
      if (isFunctionLike(n)) return false;
      if (ts.isReturnStatement(n) && n.expression && !found) found = n.expression;
      return undefined;
    });
  return found;
}

function attribute(opening, name) {
  if (!opening) return null;
  for (const attr of opening.attributes.properties) {
    if (ts.isJsxAttribute(attr) && attr.name.getText() === name) return attr;
  }
  return null;
}

function attributeExpression(attr) {
  if (!attr?.initializer) return null;
  if (ts.isStringLiteral(attr.initializer)) return attr.initializer;
  if (ts.isJsxExpression(attr.initializer)) return attr.initializer.expression ?? null;
  return null;
}

/** Every string piece (literals, template parts) inside `node`. */
function stringsIn(node) {
  const out = [];
  const take = n => {
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) out.push(n.text);
    else if (ts.isTemplateExpression(n)) {
      out.push(n.head.text);
      for (const span of n.templateSpans) out.push(span.literal.text);
    }
  };
  take(node);
  walk(node, n => {
    take(n);
  });
  return out;
}

const isNullish = node => {
  const n = strip(node);
  if (!n) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword) return true;
  if (ts.isIdentifier(n) && n.text === 'undefined') return true;
  if (ts.isJsxFragment(n) && n.children.every(c => ts.isJsxText(c) && !c.text.trim())) return true;
  if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !n.text.trim()) return true;
  return false;
};

const isJsx = node => {
  const n = strip(node);
  return !!n && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n));
};

// ---------------------------------------------------------------------------------------------------------------------
// One file: its bindings, and the names its JSX resolves to
// ---------------------------------------------------------------------------------------------------------------------

export class FileModel {
  constructor(project, path) {
    this.project = project;
    this.path = path;
    this.sf = project.parse(path);
    this.lines = this.sf.text.split('\n');
    this.imports = new Map();
    for (const st of this.sf.statements) {
      if (!ts.isImportDeclaration(st) || !st.importClause) continue;
      const spec = st.moduleSpecifier.text;
      const file = project.resolveModule(path, spec);
      const clause = st.importClause;
      if (clause.name) this.imports.set(clause.name.text, { kind: 'import', imported: 'default', spec, file });
      const named = clause.namedBindings;
      if (named && ts.isNamespaceImport(named))
        this.imports.set(named.name.text, { kind: 'namespace', imported: '*', spec, file });
      if (named && ts.isNamedImports(named)) {
        for (const el of named.elements) {
          this.imports.set(el.name.text, {
            kind: 'import',
            imported: (el.propertyName ?? el.name).text,
            spec,
            file,
          });
        }
      }
    }
  }

  binding(name) {
    return this.imports.get(name) ?? null;
  }

  /** The declaration `name` refers to at `at`: a parameter, a local / module variable, a function, or an import. */
  lookup(name, at) {
    for (let scope = at; scope; scope = scope.parent) {
      if (isFunctionLike(scope)) {
        for (const param of scope.parameters) {
          if (bindsName(param.name, name)) return { kind: 'param', node: param, fn: scope };
        }
      }
      const statements =
        ts.isBlock(scope) || ts.isSourceFile(scope) || ts.isModuleBlock(scope) ? scope.statements : null;
      if (!statements) continue;
      for (const st of statements) {
        if (ts.isVariableStatement(st)) {
          for (const d of st.declarationList.declarations) {
            if (bindsName(d.name, name))
              return { kind: 'var', node: d, init: d.initializer, destructured: !ts.isIdentifier(d.name) };
          }
        }
        if ((ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) && st.name?.text === name)
          return { kind: 'function', node: st };
      }
    }
    const imp = this.binding(name);
    return imp ? { ...imp } : null;
  }

  /** The name an identifier stands for (through an import rename or a local alias), e.g. `Bars` -> `ChildSkeleton`. */
  canonical(name, at, depth = 0) {
    const decl = this.lookup(name, at);
    if (!decl) return name;
    if (decl.kind === 'import') return decl.imported === 'default' ? name : decl.imported;
    if (decl.kind === 'var' && !decl.destructured && decl.init && depth < 4) {
      const n = strip(decl.init);
      if (ts.isIdentifier(n)) return this.canonical(n.text, decl.node, depth + 1);
      if (ts.isPropertyAccessExpression(n) && this.binding(dottedName(n.expression))?.kind === 'namespace')
        return n.name.text;
    }
    return name;
  }

  /** The name a tag / callee resolves to (`NS.X` through a namespace import is `X`; `A.B` stays dotted). */
  resolveName(node) {
    const n = strip(node);
    if (!n) return '';
    if (ts.isIdentifier(n)) return this.canonical(n.text, n);
    if (ts.isPropertyAccessExpression(n)) {
      const left = dottedName(n.expression);
      if (this.binding(left)?.kind === 'namespace') return n.name.text;
      const leftResolved = ts.isIdentifier(strip(n.expression)) ? this.canonical(left, n) : left;
      return `${leftResolved}.${n.name.text}`;
    }
    return dottedName(n);
  }

  line(node) {
    return this.sf.getLineAndCharacterOfPosition(node.getStart(this.sf)).line + 1;
  }

  optedOut(node, rule) {
    const line = this.line(node);
    const window = this.lines.slice(Math.max(0, line - 3), line).join('\n');
    if (window.includes(OPT_OUT_ANY)) return true;
    return COUNT_RULE_SET.has(rule) && window.includes(OPT_OUT_COUNT);
  }
}

function bindsName(bindingName, name) {
  if (ts.isIdentifier(bindingName)) return bindingName.text === name;
  if (ts.isObjectBindingPattern(bindingName) || ts.isArrayBindingPattern(bindingName)) {
    return bindingName.elements.some(el => !ts.isOmittedExpression(el) && bindsName(el.name, name));
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// The project: files, the declaration index, module resolution
// ---------------------------------------------------------------------------------------------------------------------

/**
 * A project: `trees` are `{ dir, report, sources? }` (report: findings are collected for it; else it is only indexed, as
 * the installed lib is for a host). `@/` resolves to the tree's own `dir`; a package import resolves by name through
 * the declaration index.
 */
export class Project {
  /** A tree's `sources` (path -> text) replaces reading it from disk (a fixture, a single file). */
  constructor({ trees } = {}) {
    this.trees = trees.map(t => ({ ...t, dir: resolve(t.dir) }));
    this.text = new Map();
    this.treeOf = new Map();
    for (const tree of this.trees) {
      const entries = tree.sources
        ? [...tree.sources].map(([path, text]) => [resolve(path), text])
        : [...walkSourceFiles(tree.dir)].map(path => [path, null]);
      for (const [path, given] of entries) {
        if (this.text.has(path)) continue;
        this.text.set(path, given ?? readFileSync(path, 'utf8'));
        this.treeOf.set(path, tree);
      }
    }
    this.parsed = new Map();
    this.declaredIn = new Map();
    for (const [path, text] of this.text) {
      for (const m of text.matchAll(/\b(?:function\s*\*?|const|let|class)\s+([A-Z][\w$]*)\b/g)) {
        if (!this.declaredIn.has(m[1])) this.declaredIn.set(m[1], new Set());
        this.declaredIn.get(m[1]).add(path);
      }
    }
    this.switchCache = new Map();
    this.scopeHooks = this.#scopeHooks();
    this.deprecated = this.#deprecatedSkeletons();
  }

  parse(path) {
    let sf = this.parsed.get(path);
    if (!sf) {
      const text = this.text.get(path) ?? readFileSync(path, 'utf8');
      sf = ts.createSourceFile(
        path,
        text,
        ts.ScriptTarget.Latest,
        true,
        path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      this.parsed.set(path, sf);
    }
    return sf;
  }

  /** Hooks that read the loading scope (`useLoadingScope` and every `use*` whose body calls one). */
  #scopeHooks() {
    const hooks = new Set([SCOPE_HOOK]);
    const candidates = [...this.text].filter(([, text]) => text.includes(SCOPE_HOOK)).map(([path]) => path);
    for (let round = 0; round < 3; round++) {
      const before = hooks.size;
      for (const path of candidates) {
        const sf = this.parse(path);
        walk(sf, n => {
          if (!isFunctionLike(n)) return undefined;
          const name = functionName(n);
          if (/^use[A-Z]/.test(name) && !hooks.has(name) && this.#callsHook(n, hooks)) hooks.add(name);
          return undefined;
        });
      }
      if (hooks.size === before) break;
    }
    return hooks;
  }

  #callsHook(fn, hooks) {
    let found = false;
    const body = bodyOf(fn);
    if (!body) return false;
    walk(body, n => {
      if (found) return false;
      if (n !== fn && isFunctionLike(n) && isComponentName(functionName(n))) return false;
      if (ts.isCallExpression(n)) {
        const callee = dottedName(n.expression).split('.').pop();
        if (hooks.has(callee)) found = true;
        if (callee === 'useContext' && /LoadingScope/.test(n.arguments[0]?.getText() ?? '')) found = true;
      }
      return undefined;
    });
    return found;
  }

  /** Whether a function calls the loading scope (directly or through a hook that does). */
  callsScope(fn) {
    return this.#callsHook(fn, this.scopeHooks);
  }

  /** The `*Skeleton` components the indexed source marks `@deprecated` (the JSDoc above their export). */
  #deprecatedSkeletons() {
    const names = new Set();
    for (const text of this.text.values()) {
      if (!text.includes('@deprecated')) continue;
      for (const m of text.matchAll(
        /\/\*\*((?:(?!\*\/)[\s\S])*)\*\/\s*(?:\/\/[^\n]*\n\s*)*export\s+(?:function|const)\s+([A-Z][A-Za-z0-9]*Skeleton)\b/g,
      )) {
        if (m[1].includes('@deprecated')) names.add(m[2]);
      }
    }
    return names;
  }

  /** The file an import specifier points to, from `fromPath` (relative or `@/`), or null for a package. */
  resolveModule(fromPath, spec) {
    const tree = this.treeOf.get(fromPath);
    let base = null;
    if (spec.startsWith('@/') && tree) base = join(tree.dir, spec.slice(2));
    else if (spec.startsWith('.')) base = resolve(dirname(fromPath), spec);
    if (!base) return null;
    for (const candidate of [base, `${base}.tsx`, `${base}.ts`, join(base, 'index.tsx'), join(base, 'index.ts')]) {
      if (/\.tsx?$/.test(candidate) && this.text.has(candidate)) return candidate;
      if (/\.tsx?$/.test(candidate) && existsSync(candidate) && statSync(candidate).isFile()) {
        this.text.set(candidate, readFileSync(candidate, 'utf8'));
        if (tree) this.treeOf.set(candidate, { ...tree, report: false });
        return candidate;
      }
    }
    return null;
  }

  /** The top-level declaration of `name` in `path` (a function, or a variable's initializer), or null. */
  declarationIn(path, name) {
    const sf = this.parse(path);
    for (const st of sf.statements) {
      if (ts.isFunctionDeclaration(st) && st.name?.text === name) return { kind: 'function', node: st };
      if (ts.isClassDeclaration(st) && st.name?.text === name) return { kind: 'class', node: st };
      if (ts.isVariableStatement(st)) {
        for (const d of st.declarationList.declarations) {
          if (ts.isIdentifier(d.name) && d.name.text === name) return { kind: 'var', node: d, init: d.initializer };
        }
      }
    }
    return null;
  }

  /** Whether component `name` switches itself (its function reads the loading scope), in any module declaring it. */
  componentSwitches(name, depth = 0) {
    if (this.switchCache.has(name)) return this.switchCache.get(name);
    this.switchCache.set(name, false);
    let result = false;
    for (const path of this.declaredIn.get(name) ?? []) {
      if (this.#declarationSwitches(path, name, depth)) {
        result = true;
        break;
      }
    }
    this.switchCache.set(name, result);
    return result;
  }

  #declarationSwitches(path, name, depth) {
    const decl = this.declarationIn(path, name);
    if (!decl) return /\buseLoadingScope\s*\(/.test(this.text.get(path) ?? '');
    let fn = null;
    if (decl.kind === 'function') fn = decl.node;
    else if (decl.kind === 'var' && decl.init) fn = functionInside(decl.init);
    if (!fn) {
      // `const Y = X` / `Object.assign(X, {...})`: follow X.
      const target = decl.init ? aliasTarget(decl.init) : null;
      return target && depth < 3 && target !== name ? this.componentSwitches(target, depth + 1) : false;
    }
    if (this.callsScope(fn)) return true;
    // Delegation: the function returns a component that switches, handing it the loading state (`loading` or a spread).
    let delegated = false;
    walk(bodyOf(fn) ?? fn, n => {
      if (delegated) return false;
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = dottedName(n.tagName);
        if (tag === 'LoadingWhen') delegated = true;
        // Only the component's own props spread hand it the loading state (`<Link {...anchorProps}>` does not).
        const ownProps = new Set(
          fn.parameters.flatMap(param =>
            ts.isIdentifier(param.name)
              ? [param.name.text]
              : ts.isObjectBindingPattern(param.name)
                ? param.name.elements.filter(e => e.dotDotDotToken && ts.isIdentifier(e.name)).map(e => e.name.text)
                : [],
          ),
        );
        const handsLoading = n.attributes.properties.some(
          a =>
            (ts.isJsxSpreadAttribute(a) && ownProps.has(a.expression.getText())) ||
            (ts.isJsxAttribute(a) && /^(?:loading|isLoading)$/.test(a.name.getText())),
        );
        const target = tag.split('.').pop();
        if (handsLoading && depth < 3 && isComponentName(target) && target !== name)
          delegated = this.componentSwitches(target, depth + 1);
      }
      return undefined;
    });
    return delegated;
  }

  /** Whether a component (resolved from `fromPath`) marks its items or parts with `pattern`. */
  componentMarks(fromPath, local, pattern) {
    const model = this.model(fromPath);
    const binding = model.binding(local);
    if (binding?.kind === 'import') {
      const file = binding.file;
      if (file) return pattern.test(this.text.get(file) ?? '');
      for (const path of this.declaredIn.get(binding.imported) ?? []) {
        if (pattern.test(this.text.get(path) ?? '')) return true;
      }
      return false;
    }
    const decl = this.declarationIn(fromPath, local);
    if (decl) return pattern.test(decl.node.getText());
    return false;
  }

  model(path) {
    if (!this.models) this.models = new Map();
    let m = this.models.get(path);
    if (!m) {
      m = new FileModel(this, path);
      this.models.set(path, m);
    }
    return m;
  }
}

/** A `{…}` child of an element (not an attribute's value). */
function isJsxChild(node) {
  return ts.isJsxExpression(node) && !ts.isJsxAttribute(node.parent);
}

function functionInside(init) {
  const n = strip(init);
  if (!n) return null;
  if (ts.isArrowFunction(n) || ts.isFunctionExpression(n)) return n;
  if (ts.isCallExpression(n) && WRAPPER_CALL.test(dottedName(n.expression))) {
    for (const arg of n.arguments) {
      const fn = functionInside(arg);
      if (fn) return fn;
    }
  }
  return null;
}

function aliasTarget(init) {
  const n = strip(init);
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) return n.name.text;
  if (ts.isCallExpression(n) && dottedName(n.expression) === 'Object.assign' && n.arguments[0])
    return aliasTarget(n.arguments[0]);
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------------------------------------------------

/** The last name of an identifier or a property access (`query.isLoading` -> `isLoading`). */
function leafName(node) {
  const n = strip(node);
  if (!n) return '';
  if (ts.isIdentifier(n)) return n.text;
  if (ts.isPropertyAccessExpression(n)) return n.name.text;
  return '';
}

function isLoadingFlag(node, model) {
  const n = strip(node);
  if (!n) return false;
  if ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) && LOADING_FLAG.test(leafName(n))) return true;
  // A local that holds the scope (`const scoped = useLoadingScope()`, `const busy = useLoadingScope() || x`).
  if (ts.isIdentifier(n) && model) {
    const decl = model.lookup(n.text, n);
    if (decl?.kind === 'var' && decl.init && !decl.destructured && readsScope(decl.init, model)) return true;
  }
  if (ts.isCallExpression(n) && model?.project.scopeHooks.has(dottedName(n.expression).split('.').pop())) return true;
  if (
    ts.isBinaryExpression(n) &&
    [ts.SyntaxKind.EqualsEqualsEqualsToken, ts.SyntaxKind.EqualsEqualsToken].includes(n.operatorToken.kind)
  ) {
    const lit = [n.left, n.right].map(strip).find(x => ts.isStringLiteral(x));
    return !!lit && /^(?:loading|pending)$/.test(lit.text);
  }
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    return isLoadingFlag(n.left, model) || isLoadingFlag(n.right, model);
  return false;
}

/** Whether an expression calls the loading scope (a scope hook), directly or as an operand of `||`. */
function readsScope(expr, model) {
  const n = strip(expr);
  if (ts.isCallExpression(n)) return model.project.scopeHooks.has(dottedName(n.expression).split('.').pop());
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
    return readsScope(n.left, model) || readsScope(n.right, model);
  return false;
}

function isNegated(node) {
  const n = strip(node);
  return !!n && ts.isPrefixUnaryExpression(n) && n.operator === ts.SyntaxKind.ExclamationToken;
}

function isNegatedLoading(node, model) {
  const n = strip(node);
  if (isNegated(n)) return isLoadingFlag(n.operand, model);
  if (
    ts.isBinaryExpression(n) &&
    [ts.SyntaxKind.ExclamationEqualsEqualsToken, ts.SyntaxKind.ExclamationEqualsToken].includes(n.operatorToken.kind)
  ) {
    const lit = [n.left, n.right].map(strip).find(x => ts.isStringLiteral(x));
    return !!lit && /^(?:loading|pending)$/.test(lit.text);
  }
  return false;
}

/** The root identifier of a property chain (`a?.b.c` -> `a`), or null. */
function chainRoot(node) {
  let n = strip(node);
  while (n && (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n))) n = strip(n.expression);
  return n && ts.isIdentifier(n) ? n : null;
}

/** Whether an expression reads a query's data (`data`, `xData`, `x.data`, a field of them). */
function isReadData(node, model, { hookOnly = false } = {}) {
  const n = strip(node);
  if (!n) return false;
  if (ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n)) {
    if (ts.isPropertyAccessExpression(n) && n.name.text === 'data') return true;
    return isReadData(n.expression, model, { hookOnly });
  }
  if (!ts.isIdentifier(n)) return false;
  const decl = model.lookup(n.text, n);
  const fromHook =
    decl?.kind === 'var' &&
    decl.init &&
    ts.isCallExpression(strip(decl.init)) &&
    /^use[A-Z]/.test(dottedName(strip(decl.init).expression).split('.').pop());
  if (!READ_DATA.test(n.text)) return false;
  const derived =
    decl?.kind === 'var' &&
    decl.init &&
    (!ts.isCallExpression(strip(decl.init)) || LOCAL_HOOK.test(dottedName(strip(decl.init).expression)));
  if (derived) return false;
  if (hookOnly) return fromHook || !decl;
  return n.text === 'data' || fromHook || !decl || decl.kind === 'param';
}

/** True when the condition holds WHILE the read is pending (loading, or the data missing). */
function heldWhileLoading(test, model, opts) {
  const n = strip(test);
  if (!n) return false;
  if (isLoadingFlag(n, model)) return true;
  if (isNegated(n) && isReadData(n.operand, model, opts)) return true;
  if (ts.isBinaryExpression(n)) {
    const op = n.operatorToken.kind;
    if (op === ts.SyntaxKind.BarBarToken)
      return heldWhileLoading(n.left, model, opts) || heldWhileLoading(n.right, model, opts);
    if (op === ts.SyntaxKind.AmpersandAmpersandToken)
      return (
        (heldWhileLoading(n.left, model, opts) || heldWhileLoading(n.right, model, opts)) &&
        !isNegatedLoading(n.left, model) &&
        !isNegatedLoading(n.right, model)
      );
    if (
      [ts.SyntaxKind.EqualsEqualsToken, ts.SyntaxKind.EqualsEqualsEqualsToken].includes(op) &&
      [n.left, n.right].some(isNullish)
    )
      return [n.left, n.right].some(x => !isNullish(x) && isReadData(x, model, opts));
  }
  return false;
}

/** True when the condition is FALSE while the read is pending (`!loading`, `data`, `data?.items`). */
function falseWhileLoading(test, model, opts) {
  const n = strip(test);
  if (!n) return false;
  if (isNegatedLoading(n, model)) return true;
  if (isReadData(n, model, opts)) return true;
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    return falseWhileLoading(n.left, model, opts) || falseWhileLoading(n.right, model, opts);
  return false;
}

/** Whether, inside `fn` and before `node`, the read has answered: a suspending read, a loading branch, the scope. */
function answeredBefore(fn, node, model) {
  if (!fn?.body || !ts.isBlock(fn.body)) return false;
  const pos = node.getStart();
  let answered = false;
  walk(fn.body, n => {
    if (answered || n.getStart() >= pos) return false;
    if (n !== fn && isFunctionLike(n)) return false;
    if (ts.isCallExpression(n)) {
      const callee = dottedName(n.expression).split('.').pop();
      if (SUSPENDING_READ.test(callee) || model.project.scopeHooks.has(callee)) answered = true;
    }
    if (
      ts.isIfStatement(n) &&
      n.getEnd() <= pos &&
      isLoadingFlag(n.expression, model) &&
      containsReturn(n.thenStatement)
    )
      answered = true;
    return undefined;
  });
  return answered;
}

function containsReturn(node) {
  if (ts.isReturnStatement(node)) return true;
  let hit = false;
  walk(node, n => {
    if (isFunctionLike(n)) return false;
    if (ts.isReturnStatement(n)) hit = true;
    return undefined;
  });
  return hit;
}

/** Whether `node` is drawn only while loading (a loading branch, a `*Skeleton` function, `LoadingItems`' child). */
function inLoadingContext(node, model) {
  let child = node;
  for (let p = node.parent; p; child = p, p = p.parent) {
    if (ts.isConditionalExpression(p)) {
      if (child === p.whenTrue && isLoadingFlag(p.condition, model)) return true;
      if (child === p.whenFalse && isNegatedLoading(p.condition, model)) return true;
    }
    if (
      ts.isBinaryExpression(p) &&
      p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
      child === p.right
    ) {
      if (isLoadingFlag(p.left, model)) return true;
    }
    if (ts.isIfStatement(p) && child === p.thenStatement && isLoadingFlag(p.expression, model)) return true;
    if (ts.isJsxElement(p) && model.resolveName(p.openingElement.tagName) === 'LoadingItems') return true;
    if (isFunctionLike(p) && /Skeleton$/.test(functionName(p))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------------------------------------------------

const COUNT_ORDER = ['ok', 'unnamed', 'typed', 'cap'];
const worst = list => list.reduce((a, b) => (COUNT_ORDER.indexOf(b) > COUNT_ORDER.indexOf(a) ? b : a), 'ok');

/**
 * What a count expression is: 'typed' (a literal), 'cap' (a capped count), 'unnamed' (names no source), or 'ok'.
 * Identifiers resolve to their initializer.
 */
function classifyCount(expr, model, { attr = '', depth = 0 } = {}) {
  const n = strip(expr);
  if (!n || depth > 5) return 'ok';
  if (ts.isNumericLiteral(n)) return 'typed';
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    return ts.isNumericLiteral(strip(n.right))
      ? strip(n.right).text === '0'
        ? classifyCount(n.left, model, { attr, depth: depth + 1 })
        : 'typed'
      : worst([n.left, n.right].map(b => classifyCount(b, model, { attr, depth: depth + 1 })));
  if (ts.isConditionalExpression(n)) {
    // A cap: `PAGE_SIZE > 6 ? 6 : PAGE_SIZE`, or a literal against a page size. Two literals choose between two forms.
    const branches = [n.whenTrue, n.whenFalse].map(strip);
    if (isComparison(n.condition)) return 'cap';
    if (branches.some(b => ts.isNumericLiteral(b)) && branches.some(b => SOURCE_COUNT.test(leafName(b)))) return 'cap';
    if (branches.every(b => ts.isNumericLiteral(b))) return 'ok';
    return worst([n.whenTrue, n.whenFalse].map(b => classifyCount(b, model, { attr, depth: depth + 1 })));
  }
  if (ts.isCallExpression(n) && dottedName(n.expression) === 'Math.min') return isPageCap(n) ? 'cap' : 'ok';
  if (ts.isPropertyAccessExpression(n) && n.name.text === 'length') {
    const of = strip(n.expression);
    if (!ts.isIdentifier(of) || SOURCE_COUNT.test(of.text)) return 'ok';
    const ofDecl = model.lookup(of.text, of);
    return ofDecl?.kind === 'var' && ofDecl.init && isLiteralArray(ofDecl.init) ? 'unnamed' : 'ok';
  }
  if (ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) {
    const name = leafName(n);
    if (CAP_NAME.test(name)) return 'cap';
    const root = chainRoot(n);
    const decl = root ? model.lookup(root.text, root) : null;
    // A count handed in by the caller (a prop, or a field of one) is a pass-through: checked where the caller names it.
    if (decl?.kind === 'param') return 'ok';
    // Destructured from the props (`const { rows = X } = props`): a pass-through.
    if (decl?.kind === 'var' && decl.destructured && decl.init && ts.isIdentifier(strip(decl.init))) {
      const from = model.lookup(strip(decl.init).text, decl.init);
      if (from?.kind === 'param') return 'ok';
    }
    if (!ts.isIdentifier(n))
      return SOURCE_COUNT.test(name) || (attr && name === attr) ? 'ok' : decl?.kind === 'var' ? 'ok' : 'unnamed';
    if (decl?.kind === 'var' && decl.init && !decl.destructured) {
      const init = strip(decl.init);
      if (ts.isNumericLiteral(init)) return SOURCE_COUNT.test(name) ? 'ok' : 'typed';
      const inner = classifyCount(init, model, { attr, depth: depth + 1 });
      // A declared page size, limit or `*_SKELETON_*` name is the source, whatever it is set from, unless it caps.
      if (SOURCE_COUNT.test(name)) return inner === 'cap' ? 'cap' : 'ok';
      return inner;
    }
    if (SOURCE_COUNT.test(name)) return 'ok';
    if (attr && name === attr) return 'ok';
    if (decl?.kind === 'import') return SOURCE_COUNT.test(decl.imported) ? 'ok' : 'unnamed';
    return 'unnamed';
  }
  return 'ok';
}

function isLiteralArray(init) {
  const n = strip(init);
  return (
    !!n && ts.isArrayLiteralExpression(n) && n.elements.every(e => ts.isNumericLiteral(e) || ts.isStringLiteral(e))
  );
}

function isComparison(node) {
  const n = strip(node);
  return (
    !!n &&
    ts.isBinaryExpression(n) &&
    [
      ts.SyntaxKind.GreaterThanToken,
      ts.SyntaxKind.GreaterThanEqualsToken,
      ts.SyntaxKind.LessThanToken,
      ts.SyntaxKind.LessThanEqualsToken,
    ].includes(n.operatorToken.kind)
  );
}

/** `Math.min(MAX, Math.max(MIN, x))` / `Math.max(MIN, Math.min(MAX, x))`: a clamp of a value, not a capped count. */
function isClamp(call) {
  const inner = call.arguments.some(
    a => ts.isCallExpression(strip(a)) && dottedName(strip(a).expression) === 'Math.max',
  );
  const outer = ts.isCallExpression(call.parent) && dottedName(call.parent.expression) === 'Math.max';
  return inner || outer;
}

function isPageCap(call) {
  const args = call.arguments.map(a => a.getText().trim());
  const page = args.find(a => PAGE_ARG.test(a));
  const simple = a => /^[\w$.]+$/.test(a) || /fold|screen/i.test(a);
  return !!page && args.some(a => a !== page && simple(a) && CAP_ARG.test(a));
}

/** The length expression and item callback of a list drawn N times, or null. */
function listOf(node, model) {
  // Array.from({ length: E }, cb?)
  if (ts.isCallExpression(node) && dottedName(node.expression) === 'Array.from') {
    const first = strip(node.arguments[0]);
    if (first && ts.isObjectLiteralExpression(first)) {
      const length = first.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText() === 'length');
      if (length) return { count: length.initializer, callback: node.arguments[1] ?? mappedCallback(node), node };
    }
    return null;
  }
  // Array(E) / new Array(E) (mapped, spread or filled)
  if (
    (ts.isCallExpression(node) || ts.isNewExpression(node)) &&
    dottedName(node.expression) === 'Array' &&
    node.arguments?.length === 1
  ) {
    return { count: node.arguments[0], callback: mappedCallback(spreadHost(node)), node };
  }
  // [0, 1, 2].map(cb)
  if (
    ts.isArrayLiteralExpression(node) &&
    isIndexList(node) &&
    ts.isPropertyAccessExpression(node.parent) &&
    node.parent.name.text === 'map'
  ) {
    return { count: node, callback: mappedCallback(node), node, literalArray: true };
  }
  // <LoadingItems count={E}>{cb}</LoadingItems>
  if (
    (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) &&
    model.resolveName(openingOf(node).tagName) === 'LoadingItems'
  ) {
    const count = attributeExpression(attribute(openingOf(node), 'count'));
    const child = ts.isJsxElement(node)
      ? node.children.find(c => ts.isJsxExpression(c) && c.expression)?.expression
      : attributeExpression(attribute(node, 'children'));
    return { count, callback: child, node, loadingItems: true };
  }
  return null;
}

/** `[0, 1, 2]`: a list of indexes standing for N items (not a table of widths or line counts). */
function isIndexList(node) {
  return node.elements.length > 1 && node.elements.every((e, i) => ts.isNumericLiteral(e) && Number(e.text) === i);
}

/** `[...Array(n)]` -> the array literal (whose `.map` draws the items). */
function spreadHost(node) {
  let n = node;
  if (n.parent && ts.isSpreadElement(n.parent) && ts.isArrayLiteralExpression(n.parent.parent)) n = n.parent.parent;
  // Array(n).fill(x).map / Array(n).keys()
  while (
    ts.isPropertyAccessExpression(n.parent) &&
    ['fill', 'keys'].includes(n.parent.name.text) &&
    ts.isCallExpression(n.parent.parent)
  )
    n = n.parent.parent;
  return n;
}

function mappedCallback(node) {
  let n = node;
  while (n.parent && ts.isParenthesizedExpression(n.parent)) n = n.parent;
  if (ts.isPropertyAccessExpression(n.parent) && n.parent.name.text === 'map' && ts.isCallExpression(n.parent.parent))
    return n.parent.parent.arguments[0];
  return undefined;
}

function callbackItem(callback) {
  const cb = strip(callback);
  if (!cb || !isFunctionLike(cb)) return null;
  return rootElement(returnedExpression(cb));
}

const ITEM_MARK_ATTR = /^(?:data-loading-item|listItem|listItems)$/;

/** Whether an item element is marked (on itself, by `loadingItemProps(…)`, or inside its component). */
function itemMarked(el, model) {
  if (!el) return true; // nothing to read: not a list of elements
  if (ts.isJsxFragment(el)) {
    const first = el.children.find(c => ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c));
    return first ? itemMarked(first, model) : true;
  }
  const opening = openingOf(el);
  for (const attr of opening.attributes.properties) {
    if (ts.isJsxAttribute(attr) && ITEM_MARK_ATTR.test(attr.name.getText())) return true;
    if (ts.isJsxSpreadAttribute(attr) && /loadingItemProps\s*\(|data-loading-item/.test(attr.expression.getText()))
      return true;
  }
  const tag = dottedName(opening.tagName);
  if (!isComponentName(tag)) return false;
  return model.project.componentMarks(
    model.path,
    tag.split('.')[0],
    /data-loading-item|loadingItemProps\s*\(|\blistItems?\b/,
  );
}

/** The `.map(cb)` item of the loaded branch beside a loading list (the other side of the same condition). */
function loadedListBeside(listNode, model) {
  let child = listNode;
  for (let p = listNode.parent; p && !isFunctionLike(p); child = p, p = p.parent) {
    if (ts.isConditionalExpression(p) && (isLoadingFlag(p.condition, model) || isNegatedLoading(p.condition, model))) {
      const other = child === p.whenTrue ? p.whenFalse : child === p.whenFalse ? p.whenTrue : null;
      if (!other) return null;
      let found = null;
      const visit = n => {
        if (found) return;
        if (
          ts.isCallExpression(n) &&
          ts.isPropertyAccessExpression(n.expression) &&
          n.expression.name.text === 'map' &&
          n.arguments[0] &&
          isFunctionLike(strip(n.arguments[0]))
        ) {
          found = n;
          return;
        }
        if (isFunctionLike(n)) return;
        ts.forEachChild(n, visit);
      };
      visit(other);
      return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The analysis
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Every finding of `rules` over the reported trees of `project`, as `{ rule, path, file, line, message }` (`file` is
 * relative to the finding's tree). `config.exempt` lifts rules from files.
 *
 * @param {Project} project
 * @param {{ rules?: string[], exempt?: Array<{ why?: string, files: RegExp, rules: string[] }>, files?: string[] }} [config]
 */
export function analyzeProject(project, { rules = [...PAGE_RULES, ...COUNT_RULES], exempt = [], files } = {}) {
  const enabled = new Set(rules);
  const findings = [];
  const paths = files ?? [...project.text.keys()].filter(path => project.treeOf.get(path)?.report);
  for (const path of paths) {
    const tree = project.treeOf.get(path);
    const rel = tree ? relative(tree.dir, path) : path;
    const lifted = new Set(exempt.filter(e => e.files.test(rel)).flatMap(e => e.rules));
    const active = new Set([...enabled].filter(r => !lifted.has(r)));
    if (!active.size) continue;
    findings.push(...analyzeFile(project, path, active, rel));
  }
  return findings;
}

/** Every finding in one file (see `analyzeProject`). */
export function analyzeFile(project, path, active, rel = path) {
  const model = project.model(path);
  const findings = [];
  const seen = new Set();
  const report = (rule, node, detail) => {
    if (!active.has(rule)) return;
    if (model.optedOut(node, rule)) return;
    const line = model.line(node);
    const key = `${rule}:${line}:${detail ?? ''}`;
    if (seen.has(key)) return;
    seen.add(key);
    findings.push({ rule, path, file: rel, line, message: detail ? `${detail}` : RULES[rule] });
  };
  const isTsx = path.endsWith('.tsx');
  const oneSwitchSites = new Set();

  // Registry slots and next/dynamic fallbacks (allowed forms).
  const exemptRender = (node, component) => {
    for (let p = node.parent; p; p = p.parent) {
      if (!ts.isPropertyAssignment(p)) continue;
      const key = p.name.getText();
      if (key === 'loading' && ts.isObjectLiteralExpression(p.parent) && ts.isCallExpression(p.parent.parent)) {
        if (/(?:^|\.)dynamic$/.test(dottedName(p.parent.parent.expression))) return true;
      }
      if (key === 'skeleton' && ts.isObjectLiteralExpression(p.parent)) {
        const render = p.parent.properties.find(q => ts.isPropertyAssignment(q) && q.name.getText() === 'render');
        if (render) {
          const renders = new Set();
          walk(render.initializer, n => {
            if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n))
              renders.add(model.resolveName(n.tagName).replace('Chat', ''));
          });
          if (renders.has(component)) return true;
        }
      }
    }
    return false;
  };

  /** A render of a component skeleton (`<YSkeleton>`, `createElement(YSkeleton)`, `{YSkeleton}` as a prop). */
  const skeletonRender = (node, nameNode) => {
    const name = model.resolveName(nameNode);
    if (!/^[A-Z]\w*Skeleton$/.test(name)) return;
    const component = name.slice(0, -'Skeleton'.length);
    // Deprecated lib skeletons.
    if (project.deprecated.has(name) && !project.declaredIn.get(name)?.has(path))
      report(
        'DEPRECATED_SKELETON',
        node,
        `<${name}> is deprecated in the lib (render the component in a loading scope)`,
      );
    if (name === 'DetailPageSkeleton')
      report('WHOLE_VIEW_SKELETON', node, 'DetailPageSkeleton (a whole-page skeleton)');
    const modules = project.declaredIn.get(component);
    if (!modules?.size) return;
    const own = new Set([...(modules ?? []), ...(project.declaredIn.get(name) ?? [])]);
    if (own.has(path)) return;
    if (exemptRender(node, component)) return;
    const switched = project.componentSwitches(component);
    const names = enclosingNames(node);
    const skeletonFn = names.find(n => /Skeleton$/.test(n));
    if (skeletonFn) {
      const moduleRendersChild = rendersOutsideSkeletons(model, component);
      if (moduleRendersChild && switched) {
        oneSwitchSites.add(node);
        report(
          'ONE_SWITCH',
          node,
          `<${name}> rendered by ${skeletonFn}, while this module renders <${component} />, which switches itself (render <${component} /> in ${skeletonFn} too: one switch per component)`,
        );
      }
      return;
    }
    oneSwitchSites.add(node);
    // A component family's own parts (`DataTable.Body` drawing `DataTableSkeleton` from its folder) are one component.
    if (!switched && [...(project.declaredIn.get(name) ?? [])].some(d => dirname(d) === dirname(path))) return;
    if (switched)
      report(
        'ONE_SWITCH',
        node,
        `<${name}> rendered outside ${component}'s module, which switches itself (render <${component} />: one switch per component)`,
      );
    else
      report(
        'NO_SCOPE_SWITCH',
        node,
        `<${name}> rendered outside ${component}'s module, which never switches itself (${component} should draw its own skeleton on useLoadingScope(), and this place render <${component} />)`,
      );
  };

  const components = [];

  const visit = node => {
    // --- declarations -------------------------------------------------------------------------------------------
    if (ts.isFunctionDeclaration(node) || ts.isVariableDeclaration(node)) {
      const name = node.name && ts.isIdentifier(node.name) ? node.name.text : '';
      const isDeprecated = ts
        .getJSDocTags(ts.isVariableDeclaration(node) ? node.parent.parent : node)
        .some(t => t.tagName.text === 'deprecated');
      const fnLike =
        ts.isFunctionDeclaration(node) ||
        (node.initializer && (functionInside(node.initializer) || isJsx(node.initializer)));
      if (name && WHOLE_VIEW.test(name) && fnLike && !isDeprecated)
        report('WHOLE_VIEW_SKELETON', node.name, `${name} (a whole-view skeleton)`);
    }
    if (isFunctionLike(node)) {
      const name = functionName(node);
      if (isComponentName(name) && !/Skeleton$/.test(name)) components.push(node);
      // Literal count defaults: `skeletonRows = 8` anywhere, `rows = 6` / `count = 6` / `steps = 6` in a `*Skeleton`.
      for (const param of node.parameters) checkCountDefaults(param.name, /Skeleton/.test(name));
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^(?:skeletonRows|skeletonCount)$/.test(node.name.text) &&
      node.initializer
    ) {
      if (classifyCount(node.initializer, model) === 'typed' && containsLiteralFallback(node.initializer))
        report('TYPED_COUNT', node, `a literal fallback for ${node.name.text} (name the page size)`);
    }

    // --- identifiers: retired APIs ---------------------------------------------------------------------------------
    if (ts.isIdentifier(node) && (MEMORY.has(node.text) || STAND_IN.has(node.text))) {
      if (!(
        ts.isImportSpecifier(node.parent) ||
        (ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
      ))
        report(
          'RETIRED_API',
          node,
          MEMORY.has(node.text)
            ? `${node.text} (the removed first-paint memory)`
            : `${node.text} (stand-in data is retired: draw the component's skeleton)`,
        );
    }

    // --- strings: pulse, spinner, loading text, hidden items -------------------------------------------------------
    if (
      ts.isStringLiteral(node) ||
      ts.isNoSubstitutionTemplateLiteral(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      checkString(node, node.text);
    }
    if (isTsx && ts.isJsxText(node)) {
      const text = node.text.trim();
      if (/^(?:Loading|Checking)\b/.test(text) && !inAnnouncement(node))
        report(
          'LOADING_TEXT',
          node,
          /(\.\.\.|…)$/.test(text)
            ? '"Loading…" text as a loading state (draw the component skeleton)'
            : '"Loading" text as a loading state (draw the component skeleton)',
        );
    }

    // --- JSX elements ------------------------------------------------------------------------------------------------
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) checkElement(node);
    if (ts.isJsxAttribute(node)) checkAttribute(node);

    // --- calls ---------------------------------------------------------------------------------------------------------
    if (ts.isCallExpression(node)) {
      const callee = dottedName(node.expression);
      if (/(?:^|\.)(?:createElement|jsx|jsxs|jsxDEV)$/.test(callee) && node.arguments[0]) {
        skeletonRender(node, node.arguments[0]);
        const target = model.resolveName(node.arguments[0]);
        if (LOADERS.has(target)) report('LOADER_COMPONENT', node, RULES.LOADER_COMPONENT);
      }
      if (callee === 'Math.min' && isPageCap(node) && !isClamp(node))
        report(
          'COUNT_CAP',
          node,
          `a page size or limit capped (\`${node.getText()}\`); a list's skeleton draws its full page`,
        );
    }

    // --- lists drawn N times ---------------------------------------------------------------------------------------------
    const list = listOf(node, model);
    if (list) checkList(list);

    // --- module constants that are literal lists, used while loading -------------------------------------------------
    if (ts.isIdentifier(node) && !ts.isVariableDeclaration(node.parent) && inLoadingContext(node, model)) {
      const decl = model.lookup(node.text, node);
      if (
        decl?.kind === 'var' &&
        decl.init &&
        ts.isSourceFile(decl.node.parent.parent.parent) &&
        isLiteralList(decl.init)
      )
        report(
          'TYPED_COUNT',
          node,
          `${node.text} is a literal-length list used while loading; name a page size, limit or *_SKELETON_* count`,
        );
    }

    // --- nothing while loading ----------------------------------------------------------------------------------------
    if (ts.isIfStatement(node)) checkIfNull(node);
    if (ts.isConditionalExpression(node)) checkTernaryNull(node);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      checkAndPart(node);

    ts.forEachChild(node, visit);
  };

  function checkCountDefaults(binding, inSkeleton) {
    if (!ts.isObjectBindingPattern(binding)) return;
    for (const el of binding.elements) {
      const key = (el.propertyName ?? el.name).getText();
      if (!el.initializer) continue;
      const literal = ts.isNumericLiteral(strip(el.initializer));
      if (
        literal &&
        (/^(?:skeletonRows|skeletonCount)$/.test(key) || (inSkeleton && /^(?:count|rows|steps)$/.test(key)))
      )
        report(
          'TYPED_COUNT',
          el,
          `a literal default for ${key} (name the page size, limit or a *_SKELETON_* constant)`,
        );
    }
  }

  function containsLiteralFallback(expr) {
    let hit = false;
    const v = n => {
      if (hit) return;
      if (
        ts.isBinaryExpression(n) &&
        n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken &&
        ts.isNumericLiteral(strip(n.right))
      )
        hit = true;
      ts.forEachChild(n, v);
    };
    v(expr);
    return hit;
  }

  function isLiteralList(init) {
    const n = strip(init);
    if (ts.isCallExpression(n) && dottedName(n.expression) === 'Array.from') {
      const first = strip(n.arguments[0]);
      const length =
        first && ts.isObjectLiteralExpression(first)
          ? first.properties.find(p => p.name?.getText() === 'length')
          : null;
      return !!length && ts.isNumericLiteral(strip(length.initializer));
    }
    if ((ts.isCallExpression(n) || ts.isNewExpression(n)) && dottedName(n.expression) === 'Array')
      return n.arguments?.length === 1 && ts.isNumericLiteral(strip(n.arguments[0]));
    if (ts.isArrayLiteralExpression(n)) return isIndexList(n);
    return false;
  }

  function checkString(node, text) {
    if (/\banimate-pulse\b|animate-\[pulse|animation-duration|\bbg-ods-skeleton\b/.test(text))
      report(
        'OWN_PULSE',
        node,
        'a pulse or skeleton colour of its own (use the lib skeletons, LIVE_PULSE_CLASS for live dots)',
      );
    if (/\banimate-spin\b/.test(text)) checkSpin(node);
    const attr = enclosingAttribute(node);
    const attrName = attr?.name.getText() ?? '';
    if (/^(?:Loading|Checking)\b/.test(text.trim())) {
      if (attrName === 'placeholder')
        report('LOADING_TEXT', node, '"Loading" as a placeholder (draw the field in a loading scope)');
      else if (
        !/^(?:label|aria-label|aria-valuetext|title|alt|statusLabel|loadingLabel)$/.test(attrName) &&
        !isAnnouncement(node)
      ) {
        if (/(\.\.\.|…)\s*$/.test(text) && !inAnnouncement(node))
          report('LOADING_TEXT', node, '"Loading…" text as a loading state (draw the component skeleton)');
      }
    }
    if (NTH_HIDDEN.test(text) && inLoadingContext(node, model))
      report(
        'HIDDEN_ITEMS',
        node,
        'loading items past the Nth hidden (a skeleton draws its full count at every width)',
      );
  }

  /** Inside a visually hidden status region (`role="status"`, `sr-only`): an announcement for assistive technology. */
  function inAnnouncement(node) {
    for (let p = node.parent; p && !isFunctionLike(p); p = p.parent) {
      const opening = ts.isJsxElement(p) ? p.openingElement : ts.isJsxSelfClosingElement(p) ? p : null;
      if (!opening) continue;
      const role = attributeExpression(attribute(opening, 'role'));
      const cls = attributeExpression(attribute(opening, 'className'));
      if ((role && /status|alert|log/.test(role.getText())) || (cls && /\bsr-only\b/.test(cls.getText()))) return true;
    }
    return false;
  }

  function isAnnouncement(node) {
    // `{ label: 'Loading…' }` handed to an announcing API, `aria` props spread.
    const p = node.parent;
    return (
      !!p && ts.isPropertyAssignment(p) && /^(?:label|ariaLabel|title|statusLabel|loadingLabel)$/.test(p.name.getText())
    );
  }

  function enclosingAttribute(node) {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) return p;
      if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p) || isFunctionLike(p) || ts.isStatement(p))
        return null;
    }
    return null;
  }

  function enclosingElement(node) {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isJsxOpeningElement(p) || ts.isJsxSelfClosingElement(p)) return p;
      if (isFunctionLike(p) || ts.isStatement(p)) return null;
    }
    return null;
  }

  function checkSpin(node) {
    const el = enclosingElement(node);
    const tag = el ? model.resolveName(el.tagName) : '';
    if (!PROGRESS_ICONS.has(tag)) {
      report(
        'SPINNER',
        node,
        'a spinner as a loading state (animate-spin only on an action progress icon: Loader2, RefreshCw)',
      );
      return;
    }
    // A progress icon keyed on a READ flag, or returned as the whole output.
    const fn = componentOf(el);
    let child = ts.isJsxOpeningElement(el) ? el.parent : el;
    for (let p = child.parent; p && p !== fn; child = p, p = p.parent) {
      let test = null;
      if (ts.isConditionalExpression(p) && child !== p.condition) test = p.condition;
      if (
        ts.isBinaryExpression(p) &&
        p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
        child === p.right
      )
        test = p.left;
      if (ts.isIfStatement(p) && child !== p.expression) test = p.expression;
      if (test && readFlagIn(test, fn)) {
        report('SPINNER', node, 'a spinner as a loading state (a progress icon belongs to an action, never to a read)');
        return;
      }
      if (
        ts.isReturnStatement(p) &&
        nearestFunction(p) === fn &&
        fn &&
        isComponentName(functionName(fn)) &&
        rootElement(p.expression) === (ts.isJsxOpeningElement(el) ? el.parent : el)
      ) {
        report('SPINNER', node, 'a spinner as a loading state (a progress icon belongs to an action, never to a read)');
        return;
      }
      if (ts.isJsxElement(p) && p !== child) break; // inside another element (a Button): an action's icon
    }
  }

  /** Whether a condition reads a READ flag (a hook's `loading`, `isLoading`, `isFetching`…), not an action's. */
  function readFlagIn(test, fn) {
    let hit = false;
    const v = n => {
      if (hit) return;
      if ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) && READ_FLAG.test(leafName(n))) {
        if (leafName(n) !== 'loading') hit = true;
        else if (ts.isIdentifier(n)) {
          const decl = model.lookup(n.text, n);
          if (decl?.kind === 'var' && decl.init && ts.isCallExpression(strip(decl.init))) hit = true;
        } else hit = true;
        if (hit) return;
      }
      if (ts.isBinaryExpression(n) && isLoadingFlag(n, model) && /===|==/.test(n.operatorToken.getText())) hit = true;
      ts.forEachChild(n, v);
    };
    v(test);
    return hit && !!fn;
  }

  function checkElement(opening) {
    const tag = model.resolveName(opening.tagName);
    const leaf = tag.split('.').pop();
    skeletonRender(opening, opening.tagName);
    if (LOADERS.has(leaf)) report('LOADER_COMPONENT', opening, RULES.LOADER_COMPONENT);
    if (leaf === 'Hold' || tag === 'Hold')
      report('RETIRED_API', opening, "<Hold> (stand-in data is retired: draw the component's skeleton)");
    if (leaf === 'StreamedPage') {
      for (const a of opening.attributes.properties) {
        if (ts.isJsxAttribute(a) && /^(?:skeleton|memory|remember)$/.test(a.name.getText()))
          report('RETIRED_API', a, `StreamedPage \`${a.name.getText()}\` (it takes a placeholder)`);
      }
    }
    if (leaf === 'Suspense') {
      const fallback = attribute(opening, 'fallback');
      const value = attributeExpression(fallback);
      if (!fallback)
        report('SUSPENSE_FALLBACK', opening, 'a Suspense with no fallback (use LoadingSuspense / LoadingFallback)');
      else if (value && strip(value).kind === ts.SyntaxKind.NullKeyword)
        report('SUSPENSE_FALLBACK', opening, 'a Suspense fallback of null (draw the component skeleton)');
      else if (!value || isNullish(value))
        report('SUSPENSE_FALLBACK', opening, 'an empty Suspense fallback (use LoadingSuspense / LoadingFallback)');
      else {
        const root = rootElement(value);
        const rootOpening = root && openingOf(root);
        if (rootOpening && model.resolveName(rootOpening.tagName) === 'LoadingFallback')
          report('HAND_PAIR', opening, 'a hand Suspense + LoadingFallback pair (use LoadingSuspense)');
      }
    }
    if (leaf === 'LoadingRegion' && ts.isJsxOpeningElement(opening)) {
      let inner = false;
      walk(opening.parent, n => {
        if (
          (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) &&
          model.resolveName(n.tagName) === 'LoadingScope'
        )
          inner = true;
      });
      if (inner) report('HAND_PAIR', opening, 'a hand LoadingRegion + LoadingScope pair (use LoadingFallback)');
    }
    // Counts on loading elements.
    const isSkeletonTag = /Skeleton$/.test(leaf) || /Skeleton\./.test(tag);
    for (const a of opening.attributes.properties) {
      if (!ts.isJsxAttribute(a)) continue;
      const name = a.name.getText();
      const value = attributeExpression(a);
      if (!value) continue;
      const counted =
        COUNT_ATTR.test(name) ||
        (leaf === 'LoadingItems' && name === 'count') ||
        (isSkeletonTag && /^(?:rows|count)$/.test(name));
      if (!counted) continue;
      const kind = classifyCount(value, model, { attr: name });
      if (kind === 'typed')
        report(
          'TYPED_COUNT',
          a,
          `a typed skeleton count (${name}); name the list's page size, limit or a *_SKELETON_* constant`,
        );
      else if (kind === 'cap')
        report(
          'COUNT_CAP',
          a,
          `a capped skeleton count (${name}={${value.getText()}}); a list's skeleton draws its full page`,
        );
      else if (kind === 'unnamed' && (/^(?:skeletonRows|skeletonCount)$/.test(name) || leaf === 'LoadingItems'))
        report(
          'COUNT_SOURCE',
          a,
          `${name}={${value.getText()}} does not name a page size, a limit or a *_SKELETON_* constant; name where the count comes from`,
        );
    }
  }

  function checkAttribute(attr) {
    const name = attr.name.getText();
    if (name === 'fold') report('FOLD_PROP', attr, 'a `fold` prop (a skeleton draws its full count: skeletonCount)');
    // `{YSkeleton}` handed to a prop is a parent choosing the child's skeleton.
    const value = attributeExpression(attr);
    if (value && ts.isIdentifier(strip(value))) skeletonRender(attr, value);
  }

  function checkList({ count, callback, node, loadingItems, literalArray }) {
    if (count && !literalArray && /lines?$|paragraphs?$/i.test(leafName(count))) return; // text: a typical line count
    const loading = loadingItems || inLoadingContext(node, model);
    const countName = count && !literalArray ? leafName(count) : '';
    if (loading && count && !loadingItems) {
      const kind = literalArray ? 'typed' : classifyCount(count, model, { attr: loadingItems ? 'count' : '' });
      if (kind === 'typed')
        report(
          'TYPED_COUNT',
          node,
          `a typed count in ${enclosingNames(node).find(Boolean) || 'a loading branch'}; name the list's page size, limit or a *_SKELETON_* constant`,
        );
      else if (kind === 'cap')
        report('COUNT_CAP', node, `a capped skeleton list (${count.getText()}); a list's skeleton draws its full page`);
      else if (kind === 'unnamed' && !loadingItems)
        report(
          'COUNT_SOURCE',
          node,
          `a skeleton list of ${count.getText()} items; name the page size, limit or a *_SKELETON_* constant`,
        );
    }
    // The cells of one row (`columns`, `cells`) are not list items: their count never changes the row's height.
    const cells = /(?:col(?:umn)?s?|cells?)$/i.test(countName);
    const isList = !cells && (loadingItems || (countName && LIST_COUNT.test(countName) && !/LINES?$/i.test(countName)));
    const item = callbackItem(callback);
    if (loading && item) {
      const opening = openingOf(item);
      const cls = opening && attributeExpression(attribute(opening, 'className'));
      if (cls && stringsIn(cls).some(s => BREAKPOINT_HIDDEN.test(s)))
        report(
          'HIDDEN_ITEMS',
          cls,
          'a loading item hidden per breakpoint (a skeleton draws its full count at every width)',
        );
    }
    if (!isList) return;
    if (item && !itemMarked(item, model))
      report(
        'ITEM_MARK',
        node,
        `a skeleton list of ${count ? count.getText() : 'N'} items with no data-loading-item (or loadingItemProps) on its items`,
      );
    const loaded = loadedListBeside(node, model);
    if (loaded) {
      const loadedItem = callbackItem(loaded.arguments[0]);
      if (loadedItem && !itemMarked(loadedItem, model))
        report('ITEM_MARK', loaded, 'the loaded list beside a skeleton list has no data-loading-item on its items');
    }
  }

  // ---- nothing while loading --------------------------------------------------------------------------------------

  function componentScope(node) {
    const fn = nearestFunction(node);
    if (!fn) return null;
    return isComponentName(functionName(fn)) && !/Skeleton$/.test(functionName(fn)) ? fn : null;
  }

  function checkIfNull(stmt) {
    if (!isTsx) return;
    const then = stmt.thenStatement;
    const ret = ts.isReturnStatement(then)
      ? then
      : ts.isBlock(then) && then.statements.length === 1 && ts.isReturnStatement(then.statements[0])
        ? then.statements[0]
        : null;
    if (!ret || !(ret.expression && isNullish(ret.expression))) return;
    const fn = componentScope(stmt);
    if (!fn) return;
    const test = stmt.expression;
    if (isScopeCall(test) && (delegatesToReader(fn) || returnsOptional(fn))) return;
    if (isLoadingFlag(test, model) || (heldWhileLoading(test, model) && mentionsLoading(test))) {
      report('NOTHING_WHILE_LOADING', stmt, 'nothing drawn while loading (render the component in a loading scope)');
      return;
    }
    if (heldWhileLoading(test, model) && !answeredBefore(fn, stmt, model))
      report(
        'NOTHING_WHILE_LOADING',
        stmt,
        'nothing drawn while the read is pending (draw the component in a loading scope)',
      );
  }

  function isScopeCall(test) {
    const n = strip(test);
    return ts.isCallExpression(n) && project.scopeHooks.has(dottedName(n.expression).split('.').pop());
  }

  /** A Relay container's split (`if (useLoadingScope()) return null; return <XQuery {...props} />`): the reader cannot
   *  run in a scope, and its view is drawn by the boundary's own fallback. */
  function delegatesToReader(fn) {
    let reader = false;
    walk(fn.body ?? fn, n => {
      if (isFunctionLike(n)) return false;
      if (ts.isReturnStatement(n) && n.expression) {
        const el = rootElement(n.expression);
        const opening = el && openingOf(el);
        if (opening && /(?:Query|Reader|Container|Loader)$/.test(dottedName(opening.tagName))) reader = true;
      }
      return undefined;
    });
    return reader;
  }

  /** Whether every JSX the function returns is marked `data-loading-optional` (a part some records lack). */
  function returnsOptional(fn) {
    let marked = false;
    let unmarked = false;
    walk(fn.body ?? fn, n => {
      if (isFunctionLike(n)) return false;
      if (ts.isReturnStatement(n) && n.expression && !isNullish(n.expression)) {
        const el = rootElement(n.expression);
        const opening = el && openingOf(el);
        if (opening && attribute(opening, 'data-loading-optional')) marked = true;
        else unmarked = true;
      }
      return undefined;
    });
    return marked && !unmarked;
  }

  /** Whether `flag` drives an action in this component (`loading` / `disabled` of a `*Button`): an action's progress. */
  function actionFlag(fn, flag) {
    let hit = false;
    walk(fn.body ?? fn, n => {
      if (hit) return false;
      if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && /Button$/.test(dottedName(n.tagName))) {
        for (const a of n.attributes.properties) {
          const v =
            ts.isJsxAttribute(a) && /^(?:loading|isLoading|disabled)$/.test(a.name.getText()) && attributeExpression(a);
          if (v && strip(v).getText() === flag) hit = true;
        }
      }
      return undefined;
    });
    return hit;
  }

  function mentionsLoading(test) {
    let hit = false;
    const v = n => {
      if (hit) return;
      if (isLoadingFlag(n, model) && !(ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.BarBarToken))
        hit = true;
      ts.forEachChild(n, v);
    };
    v(test);
    return hit;
  }

  function checkTernaryNull(cond) {
    if (inAttributeValue(cond)) return;
    const nullTrue = isNullish(cond.whenTrue);
    const nullFalse = isNullish(cond.whenFalse);
    if (nullTrue === nullFalse) return;
    const other = nullTrue ? cond.whenFalse : cond.whenTrue;
    if (!isJsx(other) && !inRenderPosition(cond)) return;
    const fn = componentScope(cond);
    if (!fn && !ts.isSourceFile(nearestFunctionOrFile(cond))) return;
    const whole = isWholeOutput(cond, fn);
    const opts = { hookOnly: !whole };
    const empty = nullTrue
      ? heldWhileLoading(cond.condition, model, opts)
      : falseWhileLoading(cond.condition, model, opts);
    if (!empty) return;
    const flag = nullTrue ? mentionsLoading(cond.condition) : isNegatedLoadingIn(cond.condition);
    if (!flag && fn && answeredBefore(fn, cond, model)) return;
    if (optionalHandled(cond, other) || offScreen(other)) return;
    if (!nullTrue && flag === false && switchingComponent(cond)) return; // a read-keyed part: OPTIONAL_MARK's
    if (flag && !nullTrue && switchingComponent(cond)) return;
    report(
      'NOTHING_WHILE_LOADING',
      cond,
      flag
        ? 'nothing drawn while loading (render the component in a loading scope)'
        : 'nothing drawn while the read is pending (draw the component in a loading scope)',
    );
  }

  /** Whether a node is (inside) an attribute's value, not a rendered child. */
  function inAttributeValue(node) {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isJsxAttribute(p)) return true;
      if (isJsxChild(p) || ts.isStatement(p) || isFunctionLike(p)) return false;
    }
    return false;
  }

  /** The flags a condition negates (`!loading` -> `loading`). */
  function negatedFlags(test) {
    const out = [];
    const v = n => {
      const x = strip(n);
      if (isNegated(x) && isLoadingFlag(x.operand, model)) out.push(strip(x.operand).getText());
      else if (ts.isBinaryExpression(x) && x.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
        v(x.left);
        v(x.right);
      }
    };
    v(test);
    return out;
  }

  function isNegatedLoadingIn(test) {
    const n = strip(test);
    if (isNegatedLoading(n, model)) return true;
    if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return isNegatedLoadingIn(n.left) || isNegatedLoadingIn(n.right);
    return false;
  }

  function nearestFunctionOrFile(node) {
    return nearestFunction(node) ?? node.getSourceFile();
  }

  function inRenderPosition(node) {
    let p = node.parent;
    while (p && ts.isParenthesizedExpression(p)) p = p.parent;
    return !!p && (isJsxChild(p) || ts.isReturnStatement(p) || (ts.isArrowFunction(p) && p.body === node));
  }

  function isWholeOutput(node, fn) {
    let p = node.parent;
    while (p && ts.isParenthesizedExpression(p)) p = p.parent;
    if (!p || !fn) return false;
    return (
      (ts.isReturnStatement(p) && nearestFunction(p) === fn) ||
      (p === fn && fn.body === node) ||
      (ts.isArrowFunction(p) && p === fn)
    );
  }

  function checkAndPart(bin) {
    if (!isJsx(bin.right)) return;
    let p = bin.parent;
    while (p && ts.isParenthesizedExpression(p)) p = p.parent;
    if (!p || !(isJsxChild(p) || ts.isReturnStatement(p))) return;
    const fn = componentScope(bin);
    const scopeNode = fn ?? (nearestFunction(bin) ? null : bin.getSourceFile());
    if (!scopeNode) return;
    const test = bin.left;
    if (FAILURE.test(test.getText()) || emptyState(test, bin.right)) return;
    const switching = switchingComponent(bin);
    const negLoading = isNegatedLoadingIn(test);
    const readKey = !negLoading && readFieldKey(test);
    if (!negLoading && !readKey) {
      // A read keyed on hook data, in a component that does not switch.
      if (
        !switching &&
        fn &&
        falseWhileLoading(test, model, { hookOnly: true }) &&
        !answeredBefore(fn, bin, model) &&
        !optionalHandled(bin, bin.right)
      )
        report(
          'NOTHING_WHILE_LOADING',
          bin,
          'nothing drawn while the read is pending (draw the component in a loading scope)',
        );
      return;
    }
    if (optionalHandled(bin, bin.right) || offScreen(bin.right) || skeletonOutput(bin.right)) return;
    if (inLoadedForm(bin)) return;
    if (negLoading && fn && negatedFlags(test).some(flag => actionFlag(fn, flag))) return;
    if (switching) {
      report('OPTIONAL_MARK', bin, 'a part left out while loading has no data-loading-optional');
      return;
    }
    if (negLoading)
      report('NOTHING_WHILE_LOADING', bin, 'nothing drawn while loading (render the component in a loading scope)');
  }

  /** A part that takes no room in the page (a modal, a dialog, a toast, a portal): absent while loading is no jump. */
  function offScreen(element) {
    const el = rootElement(element);
    const opening = el && openingOf(el);
    if (!opening) return false;
    if (/(?:Modal|Dialog|Drawer|Toast|Portal|Popover|Sheet|Tooltip|Status)$/.test(dottedName(opening.tagName)))
      return true;
    // A visually hidden announcement (`sr-only`, `role="status"`) takes no room either.
    const role = attributeExpression(attribute(opening, 'role'));
    const cls = attributeExpression(attribute(opening, 'className'));
    return (!!role && /status|alert|log/.test(role.getText())) || (!!cls && /\bsr-only\b/.test(cls.getText()));
  }

  /** An empty or failed state (`!hasResults`, `items.length === 0`, `<EmptyState />`): a state, not a part of a record. */
  function emptyState(test, element) {
    if (/\.length\s*===?\s*0|!\s*has[A-Z]\w*|\bisEmpty\b|\bempty\b|\bno[A-Z]\w*/.test(test.getText())) return true;
    const el = rootElement(element);
    const opening = el && openingOf(el);
    return !!opening && /(?:Empty|Error|Failure|NotFound)\w*$/.test(dottedName(opening.tagName));
  }

  /** `x.y` / `x?.y` (a field of a record), not a flag-like field, not `props.flag`. */
  function readFieldKey(test) {
    const n = strip(test);
    if (!n || !(ts.isPropertyAccessExpression(n) || ts.isElementAccessExpression(n))) return false;
    if (ts.isPropertyAccessExpression(n) && (FLAG_FIELD.test(n.name.text) || CONFIG_FIELD.test(n.name.text)))
      return false;
    const root = chainRoot(n);
    if (!root) return false;
    if (LOADING_FLAG.test(root.text) || CONFIG_ROOT.test(root.text)) return false;
    return true;
  }

  /** Marked optional, the loaded half of an explicit pair, or inside a per-item callback. */
  function optionalHandled(expr, element) {
    const el = rootElement(element);
    const opening = el && openingOf(el);
    if (opening && attribute(opening, 'data-loading-optional')) return true;
    if (
      opening &&
      isComponentName(dottedName(opening.tagName)) &&
      model.project.componentMarks(model.path, dottedName(opening.tagName).split('.')[0], /data-loading-optional/)
    )
      return true;
    // Inside a list's per-item callback (`items.map(item => item.x && …)`).
    const fn = nearestFunction(expr);
    if (fn && !isComponentName(functionName(fn)) && ts.isCallExpression(fn.parent)) return true;
    // The loaded half of an explicit pair: the sibling just before it draws the slot's loading half
    // (`{loading && <Bar />}` or `{loading ? <Bar /> : null}`).
    let container = expr.parent;
    while (container && ts.isParenthesizedExpression(container)) container = container.parent;
    if (
      container &&
      ts.isJsxExpression(container) &&
      (ts.isJsxElement(container.parent) || ts.isJsxFragment(container.parent))
    ) {
      const siblings = container.parent.children.filter(c => !(ts.isJsxText(c) && !c.text.trim()));
      // Walk back over the loaded alternatives of the same slot (`{!loading && a && …}`, `{!loading && !a && …}`).
      for (let i = siblings.indexOf(container) - 1; i >= 0; i--) {
        const before = siblings[i];
        if (!ts.isJsxExpression(before) || !before.expression) break;
        const s = strip(before.expression);
        if (
          ts.isBinaryExpression(s) &&
          s.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken &&
          isLoadingFlag(s.left, model)
        )
          return true;
        if (ts.isConditionalExpression(s) && isLoadingFlag(s.condition, model) && isNullish(s.whenFalse)) return true;
        const alternative =
          (ts.isBinaryExpression(s) && isNegatedLoadingIn(s.left)) ||
          (ts.isConditionalExpression(s) && isNegatedLoadingIn(s.condition));
        if (!alternative) break;
      }
    }
    return false;
  }

  /**
   * Whether a part sits where the loading form draws its OWN version of the region: after an early
   * `if (loading) return …`, in the loaded half of `loading ? <A /> : <B />` (two forms of one slot), or inside a
   * popover / dialog that is never part of the page's loading form. Only a part of the one structure both forms share
   * can be left out while loading.
   */
  function inLoadedForm(node) {
    const fn = componentOf(node);
    let child = node;
    for (let p = node.parent; p && p !== fn; child = p, p = p.parent) {
      // `if (loading) { body = <bars /> } else { body = <loaded /> }`: the else is the loaded form.
      if (ts.isIfStatement(p) && child === p.elseStatement && heldWhileLoading(p.expression, model)) return true;
      if (ts.isConditionalExpression(p) && child !== p.condition) {
        const loadingTrue = isLoadingFlag(p.condition, model);
        const loadingFalse = isNegatedLoading(p.condition, model);
        const loadedHalf = loadingTrue ? p.whenFalse : loadingFalse ? p.whenTrue : null;
        const loadingHalf = loadingTrue ? p.whenTrue : p.whenFalse;
        if (loadedHalf && loadedHalf === child && !isNullish(loadingHalf)) return true;
      }
      if (
        ts.isJsxElement(p) &&
        /(?:HoverCard|Popover|Tooltip|DropdownMenu|Menu)\w*Content$|(?:Modal|Dialog|Drawer|Sheet)$/.test(
          dottedName(p.openingElement.tagName),
        )
      )
        return true;
    }
    if (!fn?.body || !ts.isBlock(fn.body)) return false;
    const pos = node.getStart();
    return fn.body.statements.some(
      st =>
        ts.isIfStatement(st) &&
        st.getEnd() <= pos &&
        isLoadingFlag(st.expression, model) &&
        containsReturn(st.thenStatement),
    );
  }

  /** Whether a function draws a loading form (a skeleton, a `loading` handed down, `LoadingItems`, `LoadingWhen`). */
  function hasLoadingForm(fn) {
    let hit = false;
    walk(fn.body ?? fn, n => {
      if (hit) return false;
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = model.resolveName(n.tagName);
        if (
          /Skeleton(?:\.\w+)?$/.test(tag) ||
          /^(?:LoadingItems|LoadingWhen|LoadingFallback|LoadingSuspense)$/.test(tag)
        )
          hit = true;
        if (n.attributes.properties.some(a => ts.isJsxAttribute(a) && /^(?:loading|isLoading)$/.test(a.name.getText())))
          hit = true;
      }
      if (ts.isCallExpression(n) && /loadingItemProps$/.test(dottedName(n.expression))) hit = true;
      // A branch on the loading flag (`isLoading ? <bars> : rows.map(…)`) is a loading form drawn in place.
      if (ts.isConditionalExpression(n) && (isLoadingFlag(n.condition, model) || isNegatedLoading(n.condition, model)))
        hit = true;
      if (ts.isIfStatement(n) && isLoadingFlag(n.expression, model)) hit = true;
      return undefined;
    });
    return hit;
  }

  function switchingComponent(node) {
    const fn = componentOf(node);
    if (fn) return project.callsScope(fn) && hasLoadingForm(fn);
    // Module-level code (a fixture snippet): the file reads the scope.
    return /\buseLoadingScope\s*\(/.test(model.sf.text);
  }

  // ---- the walk ---------------------------------------------------------------------------------------------------
  visit(model.sf);

  // ---- per component: optional parts on read fields as ternaries, and the prop-only switch ---------------------------
  for (const fn of components) checkComponent(fn);
  checkReadTernaries(model.sf);

  function checkReadTernaries(scope) {
    walk(scope, n => {
      if (ts.isConditionalExpression(n)) checkReadTernary(n);
    });
  }

  function checkReadTernary(cond) {
    if (inAttributeValue(cond)) return;
    // A link of a chain (`a ? <A /> : b ? <B /> : null`) chooses between forms of one slot.
    if (
      ts.isConditionalExpression(strip(cond.parent) ?? cond.parent) ||
      (cond.parent && ts.isConditionalExpression(cond.parent))
    )
      return;
    const nullTrue = isNullish(cond.whenTrue);
    const nullFalse = isNullish(cond.whenFalse);
    if (!nullFalse || nullTrue || !isJsx(cond.whenTrue)) return;
    if (
      !readFieldKey(cond.condition) ||
      FAILURE.test(cond.condition.getText()) ||
      emptyState(cond.condition, cond.whenTrue)
    )
      return;
    if (!switchingComponent(cond) || optionalHandled(cond, cond.whenTrue) || inLoadedForm(cond)) return;
    if (componentScope(cond) == null && nearestFunction(cond)) return;
    report('OPTIONAL_MARK', cond, 'a part left out while loading has no data-loading-optional');
  }

  function checkComponent(fn) {
    const switches = project.callsScope(fn);
    if (switches) return;
    // PROP-ONLY SWITCH: a skeleton drawn on a boolean that comes from the component's own props / locals.
    walk(fn.body ?? fn, n => {
      if (isFunctionLike(n) && n !== fn) return false;
      let test = null;
      let branch = null;
      if (ts.isIfStatement(n)) [test, branch] = [n.expression, n.thenStatement];
      else if (ts.isConditionalExpression(n))
        [test, branch] = [n.condition, isSkeletonOutput(n.whenTrue) ? n.whenTrue : n.whenFalse];
      else if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
        [test, branch] = [n.left, n.right];
      if (!test || !branch) return undefined;
      const skeleton = skeletonOutput(branch);
      if (!skeleton || oneSwitchSites.has(skeleton)) return undefined;
      if (!propDerived(test, fn) || !readsFlag(test, fn)) return undefined;
      report('PROP_ONLY_SWITCH', n, 'a switch on the loading prop alone (switch on useLoadingScope() || loading)');
      return undefined;
    });
  }

  function isSkeletonOutput(node) {
    return !!skeletonOutput(node);
  }

  /** The skeleton element a branch draws (a `return`'s, or the branch itself), or null. */
  function skeletonOutput(branch) {
    let expr = branch;
    if (ts.isReturnStatement(branch)) expr = branch.expression;
    else if (ts.isBlock(branch)) {
      const ret = branch.statements.find(s => ts.isReturnStatement(s));
      expr = ret?.expression;
    }
    if (!expr) return null;
    const el = rootElement(expr);
    const opening = el && openingOf(el);
    if (!opening) return null;
    const tag = model.resolveName(opening.tagName);
    return /Skeleton$/.test(tag.split('.').pop()) || /Skeleton\./.test(tag) ? opening : null;
  }

  /** Whether a condition reads a boolean flag (a loading-like name, or a parameter typed `boolean`), not data presence. */
  function readsFlag(test, fn) {
    let hit = false;
    const v = n => {
      if (hit || isFunctionLike(n)) return;
      if ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) && SWITCH_FLAG.test(leafName(n))) hit = true;
      else if (ts.isIdentifier(n)) {
        const decl = model.lookup(n.text, n);
        if (decl?.kind === 'param' && declaredBoolean(decl.node, n.text)) hit = true;
        if (decl?.kind === 'var' && decl.init && nearestFunction(decl.node) === fn && readsFlag(decl.init, fn))
          hit = true;
      }
      if (!hit) ts.forEachChild(n, v);
    };
    v(test);
    return hit;
  }

  /** Whether a parameter (or its destructured field `name`) is typed `boolean` in an inline type literal. */
  function declaredBoolean(param, name) {
    const type = param.type;
    if (!type) return false;
    if (ts.isIdentifier(param.name)) return type.kind === ts.SyntaxKind.BooleanKeyword;
    if (!ts.isTypeLiteralNode(type)) return false;
    return type.members.some(
      m => ts.isPropertySignature(m) && m.name.getText() === name && m.type?.kind === ts.SyntaxKind.BooleanKeyword,
    );
  }

  /** Whether every identifier a condition reads comes from the component's parameters (or locals made from them). */
  function propDerived(test, fn, depth = 0) {
    let ids = 0;
    let ok = true;
    const v = n => {
      if (!ok) return;
      if (isFunctionLike(n)) return;
      if (ts.isPropertyAccessExpression(n)) {
        v(n.expression);
        return;
      }
      if (ts.isCallExpression(n)) {
        ok = false;
        return;
      }
      if (ts.isIdentifier(n)) {
        if (n.text === 'undefined') return;
        ids++;
        const decl = model.lookup(n.text, n);
        if (!decl) {
          ok = false;
          return;
        }
        if (decl.kind === 'param') {
          if (decl.fn !== fn) ok = false;
          return;
        }
        if (decl.kind === 'var' && decl.init && depth < 3 && nearestFunction(decl.node) === fn) {
          if (!propDerived(decl.init, fn, depth + 1)) ok = false;
          return;
        }
        ok = false;
        return;
      }
      ts.forEachChild(n, v);
    };
    v(test);
    return ok && ids > 0;
  }

  return findings;
}

/** Whether `model`'s module renders `<component />` from a function that is not a skeleton. */
function rendersOutsideSkeletons(model, component) {
  let hit = false;
  walk(model.sf, n => {
    if (hit) return false;
    if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && model.resolveName(n.tagName) === component) {
      if (!enclosingNames(n).some(name => /Skeleton$/.test(name))) hit = true;
    }
    return undefined;
  });
  return hit;
}

/**
 * PAGE CODE draws no skeleton (a host's rule for its route files and screens): a skeleton primitive or any
 * `*Skeleton` rendered (`<XSkeleton>`, `XSkeleton.Part`, `TextHold`, `LayoutHold`, `createElement(XSkeleton)`), a
 * component declared `*Skeleton`, an own pulse. `components: false` checks only primitives and declarations (a
 * `lib/` helper may render a component's exported skeleton). A `next/dynamic` `loading:` fallback stays allowed.
 */
export function pageCodeFindings(project, path, rel = path, { components = true } = {}) {
  const model = project.model(path);
  const findings = [];
  const PRIMITIVE =
    /^(?:UnifiedSkeleton|TextLineSkeleton|TextHold|LayoutHold)$|^(?:TextSkeleton|MediaSkeleton|InteractiveSkeleton)\./;
  const push = (node, message) => {
    if (model.optedOut(node, 'PAGE_CODE')) return;
    findings.push({ rule: 'PAGE_CODE', path, file: rel, line: model.line(node), message });
  };
  const inDynamicLoading = node => {
    for (let p = node.parent; p; p = p.parent) {
      if (ts.isPropertyAssignment(p) && p.name.getText() === 'loading' && ts.isObjectLiteralExpression(p.parent)) {
        const call = p.parent.parent;
        if (call && ts.isCallExpression(call) && /(?:^|\.)dynamic$/.test(dottedName(call.expression))) return true;
      }
    }
    return false;
  };
  const rendered = (node, nameNode) => {
    const name = model.resolveName(nameNode);
    const raw = dottedName(nameNode);
    if (PRIMITIVE.test(name) || PRIMITIVE.test(raw)) {
      push(node, `${name.split('.')[0]} (a skeleton primitive in page code)`);
      return;
    }
    if (components && /Skeleton(?:\.\w+)?$/.test(name) && !inDynamicLoading(node))
      push(node, `<${name}> rendered by page code (render the component: it draws its own skeleton)`);
  };
  walk(model.sf, n => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) rendered(n, n.tagName);
    if (ts.isCallExpression(n) && /(?:^|\.)createElement$/.test(dottedName(n.expression)) && n.arguments[0])
      rendered(n, n.arguments[0]);
    if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name)) {
      const fnLike =
        ts.isFunctionDeclaration(n) || (n.initializer && (functionInside(n.initializer) || isJsx(n.initializer)));
      if (fnLike && /^[A-Z]\w*Skeleton$/.test(n.name.text))
        push(n.name, `${n.name.text} (a component declared as a skeleton)`);
    }
    if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && /\banimate-pulse\b/.test(n.text))
      push(n, 'animate-pulse (a skeleton drawn by page code)');
  });
  return findings;
}

/** `path:line: message` lines, sorted by path then line. */
export function formatFindings(findings, { separator = ': ' } = {}) {
  return [...findings]
    .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1))
    .map(f => `${f.file}:${f.line}${separator}${f.message} [${f.rule}]`);
}
