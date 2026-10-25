/**
 * THE loading-standard rule engine: one AST reading (the TypeScript compiler API) of the loading standard, shipped in
 * the lib (`src/loading-standard/engine.mjs`, plain ESM so a host's script imports it by file path from its installed
 * copy) and used by the lib's own test (`src/__tests__/loading-standard.test.ts`) and by every host's gate
 * (openframe-frontend's `scripts/lib/loading-gate.mjs`, run as `check-page-skeletons` / `check-skeleton-full-page`).
 * THIS HEADER IS THE ONE STATEMENT OF THE RULES: a host's gate points here and restates none of them.
 *
 * Every rule reads COMPONENTS (a function body), never lines: imports, `as` renames, local aliases
 * (`const X = YSkeleton`), namespace imports and `createElement(Y)` resolve to the name they stand for, a condition is
 * read as an expression however many lines it spans, and a value read through a local (`const busy = q.isLoading`,
 * `const user = query.data`, `const HIDE = 'max-md:hidden'`) is read as what it holds. A finding names its rule, its
 * file and its line.
 *
 * READ DATA is a value that is missing until a read answers: `data`, `xData`, `x.data` (and a field of them), anything
 * a data hook returns (a `use*` hook that calls a query: `useQuery`, `useInfiniteQuery`, `useSWR`, Relay's readers,
 * or a hook that calls one; a hook the indexed source does not declare counts as one), destructured or not, and a
 * local aliasing any of these. A READ FLAG is a loading flag a hook returns (`isLoading`, `isPending`, `loading`, a
 * `status === 'loading'`), never a context's (`use*Context`, which folds the scope itself).
 *
 * THE RULES (ids as reported; `RULES` below holds the one-line reason of each):
 *
 * ONE_SWITCH            `<YSkeleton>` (or an alias of it, or `createElement(YSkeleton)`, or `{YSkeleton}` handed to a
 *                       prop) rendered outside Y's module (the file declaring Y or YSkeleton), when Y switches itself
 *                       (its function calls the loading scope); and a skeleton primitive drawn in the loading branch
 *                       of `loading ? <Bars /> : <Y />` for such a Y. Render `<Y />`: it draws its own skeleton. A
 *                       `*Skeleton` function may compose a child's skeleton, unless its module renders `<Y />` elsewhere
 *                       (then the skeleton renders `<Y />` too: one structure).
 * NO_SCOPE_SWITCH       The same where Y never switches itself (a component and its skeleton in one folder included),
 *                       a `*Skeleton` with no component of its own (a skeleton primitive excepted), and a loading
 *                       component not named `*Skeleton` (`<XLoading />`, `<XPlaceholder />`) rendered outside its
 *                       module: Y should draw its own skeleton on the scope, and the parent render `<Y />`.
 * PROP_ONLY_SWITCH      A component that returns a skeleton on a boolean of its own (a prop, `props.x`, a local made
 *                       from them) or on a read flag of its own (`const { isLoading } = useQuery(…)`) and never calls
 *                       the loading scope in THAT component: inside a scope it draws the loaded form with no data. Its
 *                       one switch is `useLoadingScope() || loading`.
 * NOTHING_WHILE_LOADING Nothing, or a blank box, drawn while loading: `if (loading) return null | false | <div />`,
 *                       `loading ? null : <X />`, `!loading ? <X /> : null`, `{!loading && <X />}` (in a component that
 *                       does not switch), `{loading || <X />}`, the same keyed on read data (`if (!tickets) return
 *                       null`, `data ? <X /> : null`), and a `next/dynamic` import with no `loading:` fallback. Exempt
 *                       once the read has answered in that component (a suspending read, a loading branch or the scope
 *                       above it), inside a list's per-item callback, a scope `return null` whose loaded return is
 *                       marked `data-loading-optional` or is a Relay reader (`<XQuery />`), a part that takes no room
 *                       (a modal, a toast), and a flag that is an ACTION's progress (handed to a `*Button`'s `loading`
 *                       or `disabled` in the same component). A local holding the scope is a loading flag.
 * SPINNER               `animate-spin` (or `animate-[spin…`) anywhere but on an action's progress icon (`Loader2`,
 *                       `RefreshCw`), and a progress icon keyed on a READ flag (through a local too) or returned as a
 *                       component's whole output.
 * LOADER_COMPONENT      A loader as a loading state (`PageLoader`, `CompactPageLoader`, `ContentLoader`, `CardLoader`,
 *                       `DetailLoader`, `FormLoader`, `ListLoader`, `ChatCardLoader`, `OpenmspHeartbeatLoader`,
 *                       `Spinner`).
 * LOADING_TEXT          Waiting copy as a loading state: a text node starting "Loading" / "Checking", a "Loading…",
 *                       "loading…", "Fetching…", "Please wait…" (any case, `...` or `…`) string or text node, a
 *                       "Loading" placeholder. Labels, `aria-label`, `title` and a status announcement are not text.
 * OWN_PULSE             A pulse or skeleton colour of one's own (`animate-pulse`, `animate-[pulse…`, `bg-ods-skeleton`,
 *                       `animation-duration`, an inline `animation: 'pulse …'`): one pulse, the lib's.
 * SUSPENSE_FALLBACK     A `Suspense` / `React.Suspense` with no fallback, or a `Suspense` / `LoadingSuspense` fallback
 *                       of `null`, `undefined`, `false`, `''`, an empty fragment or a blank element (`<div />`), and a
 *                       `LoadingFallback` drawing nothing.
 * HAND_PAIR             A hand-built `<Suspense fallback={<LoadingFallback>…}>` (use `LoadingSuspense`), or a hand
 *                       `<LoadingRegion>` around a `<LoadingScope>` / `<LoadingWhen>` (use `LoadingFallback`).
 * RAW_SUSPENSE          A `Suspense` / `React.Suspense` with a fallback of its own. The ONE boundary is `LoadingSuspense`
 *                       (or a host's own boundary built on it, `config.boundaries`): its fallback is the component it
 *                       waits on, drawn in a loading scope, so nothing jumps when the content arrives. A boundary that
 *                       draws nothing on purpose (structured data, a crawler-only body) opts out with its reason.
 * PAGE_BOUNDARY         A page's or a layout's whole output inside one boundary (`Suspense`, `LoadingSuspense`, a
 *                       configured host boundary): the root element a route file's default export returns, a fragment
 *                       holding only it, or a slot of the object it hands a render helper. A boundary wraps only the
 *                       component that waits on a read; sections that share one read, or would look broken arriving one
 *                       by one, share one boundary; the page's static frame (heading, copy, back link, cached content)
 *                       renders at once, outside every boundary. A component that reads in the browser keeps its own
 *                       loading state (`LoadingWhen`, `useLoadingScope`) and needs no boundary.
 * WHOLE_VIEW_SKELETON   A component declared or rendered as `*PageSkeleton`, `*ScreenSkeleton`, `*DetailSkeleton`,
 *                       `*ArticleSkeleton`, `*ViewSkeleton`, `*HomeSkeleton`, `*DeckSkeleton`, `*EditorSkeleton`,
 *                       `*CenterSkeleton`, `*CatalogSkeleton`, `*FormSkeleton`, `*LayoutSkeleton`,
 *                       `*DashboardSkeleton`, `*LoadingLayout` or `*(Page|Screen|View|Panel|Dashboard)Loading` (a
 *                       declaration marked `@deprecated` is a kept alias: not counted, its renders are
 *                       DEPRECATED_SKELETON's).
 * FOLD_PROP             A `fold` prop on any element (a skeleton draws its full count: `skeletonCount`).
 * DEPRECATED_SKELETON   A render of a skeleton the lib marks `@deprecated` (read from the lib's source).
 * RETIRED_API           The retired first-paint memory, stand-in data (`standIn`, `Hold`, any `Hold*` name such as
 *                       `HoldText`; the primitives `TextHold` / `LayoutHold` are not) and `StreamedPage`'s
 *                       `skeleton` / `memory` / `remember` props.
 * TYPED_COUNT           A count typed at the place that draws it: a literal (after resolving a constant to its
 *                       initializer, both arms of a ternary included: `isMobile ? 3 : 10`) on a skeleton count prop
 *                       (`skeletonRows`, `skeletonCount`, `loadingRows`, any `(skeleton|loading|placeholder)…(Rows|
 *                       Count|Lines|Items)`, `count` on `LoadingItems`, `rows` / `count` / `lines` on a `*Skeleton`
 *                       element) or on such a key of an object (`{ loadingRows: { primary: 7 } }`), the length of a
 *                       list drawn while loading (`Array.from({ length })`, `Array(n)`, `[...Array(n)]`,
 *                       `[0, 1, 2].map`, `[1, 2, 3, 4].map`), a field of a local object holding a literal
 *                       (`const settings = { rows: 4 }` -> `settings.rows`), a literal default (other than 0) of ANY
 *                       parameter or prop whose value reaches a skeleton count in its function (`skeletonRows = 8`,
 *                       `{ size = 6 }` drawn as `<LoadingItems count={size}>`), a `?? 10` fallback in a count, and a
 *                       module constant holding a literal-length list (`Array.from({ length: 4 })`, `[1, 2, 3, 4]`)
 *                       used while loading. Text draws a typical LINE
 *                       count (`*Lines`, `*Paragraphs`) only when each item is a skeleton line itself; a list of rows
 *                       named `*LINES` is a list.
 * COUNT_SOURCE          A skeleton count that names neither a page size, a limit, `first`, nor a declared
 *                       `*_SKELETON_*` constant: a count computed by a call (`rowsFor(w)`), read from a response
 *                       (`data?.total ?? 0`), or added to a list's length (`rows.length + 2`). Not counted: a count the
 *                       caller passes (a prop, or a field of one; checked where its caller names it), a skeleton-count
 *                       field of a value (`scroll.skeletonRows`, checked where its key is set), a named count scaled
 *                       or split (`PAGE_SIZE * 2`, `rows - 1`), the rest of a page (`pageSize - items.length`), the
 *                       length of a list, and a value that is no number (`rows={[{ width }]}`). Also a `*_SKELETON_*`
 *                       count in a component whose list has a page size (`PAGE_SIZE`, `pageSize`, `perPage`): a paged
 *                       list draws its page.
 * COUNT_CAP             A count capped: `Math.min(pageSize, FOLD | CONSTANT | 8 | a local holding a number)`, a ternary
 *                       or comparison cap (`PAGE_SIZE > 6 ? 6 : PAGE_SIZE`), or a count named `*FOLD*`, `*VISIBLE*` or
 *                       `*SCREEN*` (`Math.min(PAGE_SIZE, rows.length)`, the last page, and a clamp are fine).
 * HIDDEN_ITEMS          A loading item hidden per breakpoint (`hidden md:block`, `max-md:hidden`, `md:hidden` on the
 *                       item's own element, through a class constant or a conditional class too), a container hiding
 *                       items past the Nth (`[&>*:nth-child(n+N)]:hidden`), and an item callback returning nothing past
 *                       the Nth (`i < 4 ? <Row /> : null`) while loading.
 * ITEM_MARK             A loading list (`LoadingItems`, a list whose count is a page size, limit or `*_SKELETON_*`
 *                       constant, or a pass-through count prop drawn while loading) whose items are not marked
 *                       `data-loading-item` (or `loadingItemProps(…)`, `listItem`, `listItems` on the item element, or
 *                       on the element the item's component renders, read from its declaration through its import),
 *                       and the loaded list beside it: the other branch of the same condition, or the list the
 *                       component returns after `if (loading) return …`. The cells of one row (a count named `columns`,
 *                       `cols`, `cells`) are not list items.
 * OPTIONAL_MARK         In a component that switches on the scope, a part left out while loading (`{!loading && <X />}`)
 *                       or keyed on a read field (`{record.note && <X />}`, `{record?.x ? <X /> : null}`) that does not
 *                       carry `data-loading-optional`. Not counted: an error / offline state, the loaded half of an
 *                       explicit pair (a `{loading && …}` sibling before it), a flag-like field (`show…`, `is…`,
 *                       `has…`) or a configuration / presentation field (`actions.copy`, `anchorProps.href`, `icon`), an
 *                       empty-state notice (`noX`, `!hasX`, `length === 0`), a part inside a list's per-item callback,
 *                       a link of a ternary chain, a part with no room in the page (a modal, a popover's content, an
 *                       `sr-only` / `role="status"` announcement), and a part where the loading form draws its OWN
 *                       version of the region (after an early `if (loading) return …`, in the loaded half of
 *                       `loading ? <A /> : <B />`, or the `else` of an `if` on the loading state). A component that
 *                       reads the scope but draws no loading form is not switching.
 * PAGE_CODE             A host's page code (`config.pageCode` says which files) draws no skeleton: a skeleton primitive,
 *                       a `*Skeleton` declared or rendered (`components: false` allows rendering a component's exported
 *                       skeleton), a route-level `loading.tsx`.
 * OPT_OUT               An opt-out that is not the rule-scoped form, names a rule this gate does not run, gives no
 *                       reason, or suppresses nothing.
 *
 * ALLOWED FORMS (no rule fires): a `next/dynamic` `loading: () => <YSkeleton />` fallback (inside the `dynamic(` call);
 * a registry entry's own `skeleton:` slot drawing the card its `render:` draws (`XChatCard` is X's card); an action's
 * progress icon; `return null` after a suspending read or a loading branch; error states; a ternary choosing between
 * two forms of one slot; pass-through counts; a safety-capped list drawing a declared `*_SKELETON_*` constant.
 *
 * OPT-OUT: ONE form, rule-scoped and single-line: `// loading-standard-ok(RULE_ID): <why>` (or the same inside
 * `/* … *\/`), at the end of the finding's line or alone on the line directly above it. It lifts that one rule on
 * that one line, and an opt-out that lifts nothing is itself a finding (OPT_OUT).
 *
 * CONFIG: `CONFIGS.lib`, `CONFIGS.frontend` and `CONFIGS.hub` hold each repository's rule set, reported trees, page
 * code, boundaries and exemptions, declared once here. `boundaries` names a host's own boundary components (built on
 * `LoadingSuspense`) and the attribute that makes one render directly, with no boundary (`{ StreamedSection: 'cached' }`).
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
  RAW_SUSPENSE: 'a raw Suspense (use LoadingSuspense: its fallback is the component it waits on, in a loading scope)',
  PAGE_BOUNDARY:
    'a boundary around a whole page (wrap only the component that waits on a read; the static frame renders at once)',
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
  PAGE_CODE: 'page code draws no skeleton (render the components: each draws its own)',
  OPT_OUT: 'an opt-out that is not `// loading-standard-ok(RULE_ID): <why>` or that lifts nothing',
};

const ALL_RULES = Object.keys(RULES);

/** The files a host's PAGE CODE is (its route files, every file of a route folder, its screens, its `lib/`). */
const ROUTE_FILE = /(?:^|\/)(?:page|layout|loading|template|not-found|error)\.tsx$/;
const SCREEN_FILE = /-page(?:-ssr|-client)?\.tsx$/;
/** A route file whose output is a whole page or layout (PAGE_BOUNDARY). */
const PAGE_OR_LAYOUT_FILE = /(?:^|\/)(?:page|layout)\.tsx$/;

/**
 * Each repository's rule set and exemptions. `trees` are the folders reported (relative to the tree's root; all when
 * absent). `pageCode(rel, isFile)` says whether a file is page code (`{ components }`: whether it may render a
 * component's exported skeleton) or not (null); `isFile(rel)` asks whether a file exists in the tree. An exemption
 * names the files (a RegExp over the path relative to the tree's root) and the rules it lifts, and says why.
 */
export const CONFIGS = {
  frontend: {
    rules: ALL_RULES,
    trees: ['app', 'components', 'lib', 'hooks'],
    /**
     * Every route file under `app/`, every other `.tsx` in a ROUTE FOLDER (a folder under `app/` holding a `page.tsx`
     * or a `layout.tsx`), every screen file (`*-page.tsx`, `*-page-client.tsx`, `*-page-ssr.tsx`) and every `.tsx`
     * under `lib/` (which may render a component's exported skeleton).
     */
    pageCode(rel, isFile) {
      if (!rel.endsWith('.tsx')) return null;
      if (rel.startsWith('lib/')) return { components: false };
      if (SCREEN_FILE.test(rel) && (rel.startsWith('app/') || rel.startsWith('components/')))
        return { components: true };
      if (!rel.startsWith('app/')) return null;
      const folder = dirname(rel);
      if (ROUTE_FILE.test(rel) || isFile(join(folder, 'page.tsx')) || isFile(join(folder, 'layout.tsx')))
        return { components: true };
      return null;
    },
    exempt: [],
  },
  /**
   * The hub (multi-platform-hub) runs the BOUNDARY rules from this engine; its own gate (`check-page-skeletons.mjs`)
   * still holds its older skeleton checks. Its server boundary is `StreamedSection` (a read, drawn from a placeholder in
   * a loading scope until it answers), which renders directly when told `cached`.
   */
  hub: {
    rules: ['SUSPENSE_FALLBACK', 'HAND_PAIR', 'RAW_SUSPENSE', 'PAGE_BOUNDARY'],
    trees: ['app', 'components', 'lib'],
    boundaries: { StreamedSection: 'cached' },
    exempt: [],
  },
  lib: {
    rules: ALL_RULES,
    exempt: [
      {
        why: "the lib's own loading primitives: the one pulse, the scope, the fallback and the Suspense wrapper are built here",
        files:
          /(?:^|\/)components\/(?:loading\/(?:loading-fallback|loading-region|unified-skeleton)|ui\/(?:loading-scope|skeleton[\w-]*|text-line-skeleton))\.tsx?$/,
        rules: ['OWN_PULSE', 'HAND_PAIR', 'SUSPENSE_FALLBACK', 'RAW_SUSPENSE', 'NOTHING_WHILE_LOADING'],
      },
      {
        why: "the loaders themselves (declared, never a screen state in the lib), the Button's own action progress, and the chat registry's card loader (a card read by id, drawn by the card's own skeleton)",
        files:
          /(?:^|\/)components\/(?:ui\/(?:[\w-]+-)?loader|loading\/openmsp-heartbeat|ui\/button\/button|chat\/entity-cards\/dispatch)\.tsx$/,
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
const READ_FLAG = /^(?:isLoading|isFetching|isRefetching|isInitialLoading|isPending|loading)$/;
const READ_DATA = /^(?:data|[a-z]\w*Data)$/;
const SWITCH_FLAG = /loading|pending|skeleton|busy|fetching|waiting/i;
const LOCAL_HOOK = /(?:^|\.)(?:useMemo|useState|useCallback|useRef|useReducer|useDeferredValue|useId|useTransition)$/;
const SUSPENDING_READ =
  /^(?:useLazyLoadQuery|usePreloadedQuery|useFragment|usePaginationFragment|useRefetchableFragment|useSuspenseQuery|useSuspenseQueries|use)$/;
/** The read primitives a DATA HOOK calls (directly, or through another data hook). */
const QUERY_HOOK =
  /^(?:useQuery|useQueries|useInfiniteQuery|useSuspenseQuery|useSuspenseQueries|useSuspenseInfiniteQuery|useSWR|useSWRInfinite|useLazyLoadQuery|usePreloadedQuery|useFragment|usePaginationFragment|useRefetchableFragment|useQueryLoader)$/;
/** Hooks that never return read data (routing, forms, layout, stores, contexts). */
const NOT_DATA_HOOK =
  /^(?:useRouter|usePathname|useSearchParams|useParams|useSelectedLayoutSegments?|useTranslation|useTheme|useMediaQuery|useIsMobile|useBreakpoint|useToast|useForm|useFormContext|useFormState|useWatch|useController|useFieldArray|useSelector|useDispatch|useMutation|useQueryClient|useRelayEnvironment|useLoadingScope|use\w*(?:Context|Store|State|Mutation|Ref|Callback|Effect|Handler|Toggle|Modal|Dialog)|use\w*(?:Flag|Gate|Feature)s?)$/;
/** Fields of a hook's result that are not its data (flags, errors, actions). */
const NOT_DATA_FIELD =
  /^(?:error|errors|status|refetch|fetchNextPage|fetchMore|loadMore|reset|mutate|mutateAsync|hasNextPage|hasMore|set[A-Z]\w*|on[A-Z]\w*|is[A-Z]\w*|has[A-Z]\w*)$/;
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
/**
 * The lib's skeleton parts: what a `*Skeleton` (or a component's own loading branch) is built from.
 * `TextLinesByBreakpointSkeleton` is `TextLineSkeleton` at a line count per width (a wrapping title or paragraph):
 * bars with no component of their own, like the rest of the list.
 */
const PRIMITIVE =
  /^(?:UnifiedSkeleton|TextLineSkeleton|TextLinesByBreakpointSkeleton|FieldValueSkeleton|TextHold|LayoutHold|Skeleton)$|^(?:TextSkeleton|MediaSkeleton|InteractiveSkeleton)\./;
/** The lib's loading wrappers (not loading states of a component). */
const LOADING_WRAPPER = /^(?:Loading(?:Items|When|Fallback|Suspense|Scope|Region)|InertWhileLoading)$/;
const WHOLE_VIEW =
  /^[A-Z]\w*(?:(?:Page|Screen|Detail|Article|View|Home|Deck|Editor|Center|Catalog|Form|Layout|Dashboard)Skeleton|LoadingLayout|(?:Page|Screen|View|Panel|Dashboard)Loading)$/;
/** A loading component that is not named `*Skeleton` (`XLoading`; `XPlaceholder` when drawn while loading). */
const LOADING_COMPONENT = /^[A-Z]\w*Loading$/;
const PLACEHOLDER_COMPONENT = /^[A-Z]\w*Placeholder$/;
const MEMORY = new Set([
  'pageFirstPaint',
  'firstPaintKvStore',
  'createFirstPaintMemory',
  'careersSeed',
  'refreshCareersSeed',
  'lastKnownHomeLayout',
  'rememberHomeLayout',
]);
const STAND_IN = new Set(['standIn', 'isStandIn', 'STAND_IN_MARK', 'useHolds', 'HELD_CONTROL_CLASS']);
/** The retired stand-in family (`Hold`, `HoldText`, `HoldStandIn`, …); the primitives `TextHold` / `LayoutHold` are not. */
const HOLD_NAME = /^Hold(?:[A-Z]\w*)?$/;
const isRetiredName = name => MEMORY.has(name) || STAND_IN.has(name) || HOLD_NAME.test(name);
const COUNT_ATTR = /^(?:skeletonRows|skeletonCount|(?:skeleton|loading|placeholder)\w*(?:Rows|Count|Lines|Items))$/i;
/**
 * THE count vocabulary, declared once: where a list's count comes from (its PAGE: a page size or a limit) and what caps
 * it (a fold, a screen, what is visible). Every count rule reads these two lists.
 */
const PAGE_SOURCE = {
  pageSize: ['PAGE_SIZE', 'PER_PAGE', 'pageSize', 'PageSize', 'page_size', 'perPage', 'PerPage', 'per_page'],
  /** A limit: `LIMIT` anywhere in a constant, `limit` / `Limit` ending a name. */
  limit: ['LIMIT', 'limit$', 'Limit$'],
};
const CAP_WORDS = ['fold', 'visible', 'screen'];
/** A page size (not a safety limit): a list that has one draws it, never a `*_SKELETON_*` count. */
const PAGE_SIZE_NAME = new RegExp(PAGE_SOURCE.pageSize.join('|'));
/** A count that names where it comes from: a page size, a limit, `first` or a declared `*_SKELETON_*` constant. */
const COUNT_SOURCE_NAME = new RegExp(
  [...PAGE_SOURCE.pageSize, ...PAGE_SOURCE.limit, '(?:^|_)SKELETON_', '^first$'].join('|'),
);
/** An argument of `Math.min` that is the page (a page size, a limit, a `*_MAX` constant), in any spelling. */
const PAGE_ARG = new RegExp(
  [...PAGE_SOURCE.pageSize, ...PAGE_SOURCE.limit.map(w => w.replace('$', '\\b')), '[A-Z_]*_MAX\\b'].join('|'),
  'i',
);
/** A count named for what it caps to (`ROW_FOLD`, `visibleRows`, `SCREEN_ROWS`). */
const CAP_NAME = new RegExp(CAP_WORDS.join('|'), 'i');
/** An argument of `Math.min` beside the page that caps it: a cap name, a constant or a number. */
const isCapArg = text => CAP_NAME.test(text) || /\b[A-Z][A-Z0-9_]{2,}\b|^\d+$/.test(text);
/** The cells of one row (`columns`, `cells`): their count never changes the row's height. */
const isCellCount = name => /(?:col(?:umn)?s?|cells?)$/i.test(name);
/** A text's line count (`lines`, `paragraphs`): a typical count of the text it stands for, not a list. */
const isTextLineCount = name => /lines?$|paragraphs?$/i.test(name);
/** A count handed in by the caller that a skeleton draws as its items. */
const PASSED_COUNT = /^(?:count|rows|items|rowCount|itemCount)$/;
/** A condition on the screen's width (`isMobile ? 3 : 10`). */
const WIDTH_TEST = /mobile|desktop|tablet|breakpoint|width|viewport|isSmall|isLarge|narrow/i;
const BREAKPOINT_HIDDEN =
  /(?:^|\s)(?:hidden\s+(?:[\w-]+:)+(?:block|flex|grid|inline|inline-flex|inline-block|table|table-row|table-cell|contents)|(?:[\w-]+:)+hidden)(?=\s|$)|(?:^|\s)(?:[\w-]+:)+(?:block|flex|grid|inline|inline-flex|table-row|table-cell|contents)\s+hidden(?=\s|$)/;
const NTH_HIDDEN = /nth-child\([^)]*\)\]:hidden/;
const SPIN_CLASS = /\banimate-spin\b|\banimate-\[spin/;
const PULSE_CLASS = /\banimate-pulse\b|\banimate-\[pulse|animation-duration|\bbg-ods-skeleton\b/;
/** Waiting copy: "Loading"/"Checking" text nodes, and any of these words ending in an ellipsis. */
const WAIT_TEXT = /^(?:loading|checking)\b/i;
const WAIT_ELLIPSIS = /^(?:loading|checking|fetching|please wait)\b.*(?:\.\.\.|…)\s*$/i;
const FLAG_FIELD =
  /^(?:is|has|show|should|can|enable|hide|with|allow)(?=[A-Z]|$)|^(?:enabled|hidden|disabled|open|visible|selected|active|expanded|collapsed|checked|loading|length)$/;
const CONFIG_FIELD = /^(?:icon|children|actions?|className|style|href|on[A-Z]\w*|render[A-Z]?\w*)$/;
/** Roots that hold configuration or presentation, never a record (`actions.copy`, `anchorProps.href`). */
const CONFIG_ROOT =
  /^(?:props|this|window|document|process|config|settings|options|actions|theme|styles?|classes|t|i18n|router|navigation|form|field|meta|labels|copy|\w+Props)$/i;
const FAILURE = /error|offline|failed|failure/i;
/** The one opt-out form (see the header). */
const OPT_OUT_MARK = /loading-standard-ok\(\s*([A-Z_]+)\s*\):(.*)$/;
const OPT_OUT_ANY = /loading-standard-ok|full-page-ok/;
const WRAPPER_CALL = /^(?:memo|forwardRef|observer|React\.memo|React\.forwardRef)$|^with[A-Z]/;
/** The attributes that mark a list item for the height gate. */
const ITEM_MARK_ATTR = /^(?:data-loading-item|listItem|listItems)$/;
const OFF_SCREEN = /(?:Modal|Dialog|Drawer|Toast|Portal|Popover|Sheet|Tooltip|Status)$/;

// ---------------------------------------------------------------------------------------------------------------------
// Files
// ---------------------------------------------------------------------------------------------------------------------

const SKIPPED_DIRS = new Set(['node_modules', '__tests__', '__fixtures__', 'stories']);
const TEST_FILE = /\.(?:test|stories|spec)\.tsx?$/;

/** Every `.ts` / `.tsx` file under `dir`, without dependencies, dot folders, tests and stories. */
function* walkSourceFiles(dir) {
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
function functionName(fn) {
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

/** The class strings of an expression, a constant it names read as the string it holds (`MOBILE_HIDE`). */
function classStrings(expr, model, depth = 0) {
  const out = stringsIn(expr);
  const visit = n => {
    if (ts.isIdentifier(n) && depth < 3) {
      const decl = model.lookup(n.text, n);
      if (decl?.kind === 'var' && decl.init && !decl.destructured)
        out.push(...classStrings(decl.init, model, depth + 1));
    }
    ts.forEachChild(n, visit);
  };
  visit(expr);
  return out;
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

/** What renders nothing: `null`, `undefined`, `false`, `''`, an empty fragment. */
const isNullish = node => {
  const n = strip(node);
  if (!n) return false;
  if (n.kind === ts.SyntaxKind.NullKeyword || n.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (ts.isIdentifier(n) && n.text === 'undefined') return true;
  if (ts.isJsxFragment(n) && n.children.every(c => ts.isJsxText(c) && !c.text.trim())) return true;
  if ((ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) && !n.text.trim()) return true;
  return false;
};

/** Nothing, or a blank box: an HTML element with no children and nothing but layout attributes (`<div className="h-64" />`). */
const isBlank = node => {
  if (isNullish(node)) return true;
  const n = strip(node);
  if (!n || !(ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n))) return false;
  const opening = openingOf(n);
  if (!/^[a-z]/.test(opening.tagName.getText())) return false;
  if (ts.isJsxElement(n) && n.children.some(c => !(ts.isJsxText(c) && !c.text.trim()))) return false;
  return opening.attributes.properties.every(
    a => ts.isJsxAttribute(a) && /^(?:className|style|key|aria-hidden|role)$/.test(a.name.getText()),
  );
};

const isJsx = node => {
  const n = strip(node);
  return !!n && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n) || ts.isJsxFragment(n));
};

/** The name node a node renders: a JSX tag, or the first argument of `createElement` / `jsx`. Else null. */
function renderedTag(node) {
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) return node.tagName;
  if (
    ts.isCallExpression(node) &&
    node.arguments[0] &&
    /(?:^|\.)(?:createElement|jsx|jsxs|jsxDEV)$/.test(dottedName(node.expression))
  )
    return node.arguments[0];
  return null;
}

/** Whether a resolved tag is a skeleton (`XSkeleton`, `XSkeleton.Part`, `TextSkeleton.Body`). */
const isSkeletonName = tag => /Skeleton(?:\.\w+)?$/.test(tag);
/** Whether an attribute of an element is a skeleton count: a `*Rows`/`*Count` skeleton prop, `LoadingItems`' `count`, a `*Skeleton`'s `rows` / `count`. */
const isCountAttribute = (tag, name) =>
  COUNT_ATTR.test(name) ||
  (tag.split('.').pop() === 'LoadingItems' && name === 'count') ||
  (isSkeletonName(tag) && /^(?:rows|count)$/.test(name));
/** Whether a function (or a name) is a skeleton's: `XSkeleton`, `renderRowSkeleton`. */
const isSkeletonFunctionName = name => /Skeleton$/.test(name);
/** Whether a name is a component skeleton's (`XSkeleton`, capitalised), the component being `X`. */
const isComponentSkeletonName = name => isComponentName(name) && name !== 'Skeleton' && isSkeletonFunctionName(name);
/** Whether a call is `next/dynamic`'s (`dynamic(…)`, `x.dynamic(…)`). */
const isDynamicCall = node => ts.isCallExpression(node) && /(?:^|\.)dynamic$/.test(dottedName(node.expression));

/** Whether a node sits in a `next/dynamic` call's `loading:` slot (the allowed fallback form). */
function inDynamicLoading(node) {
  for (let p = node.parent; p; p = p.parent) {
    if (!ts.isPropertyAssignment(p) || p.name.getText() !== 'loading' || !ts.isObjectLiteralExpression(p.parent))
      continue;
    const call = p.parent.parent;
    if (call && isDynamicCall(call)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// One file: its bindings, and the names its JSX resolves to
// ---------------------------------------------------------------------------------------------------------------------

class FileModel {
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

  /**
   * The file's opt-out markers (see the header): `{ line, rule, why, covers, used }`, `rule` null when the marker is
   * not the rule-scoped form. A marker covers its own line, and the next one when it stands alone on its line.
   */
  get markers() {
    if (!this._markers) {
      this._markers = [];
      this.lines.forEach((text, index) => {
        if (!OPT_OUT_ANY.test(text)) return;
        const mark = OPT_OUT_MARK.exec(text);
        const alone = /^\s*(?:\/\/|\/\*|\{\s*\/\*)/.test(text);
        const line = index + 1;
        this._markers.push({
          line,
          rule: mark?.[1] || null,
          why: mark ? mark[2].split('*/')[0].trim() : '',
          covers: alone ? [line, line + 1] : [line],
          used: false,
        });
      });
    }
    return this._markers;
  }

  /** Whether a marker lifts `rule` at `node`'s line (and records that it did). */
  optedOut(node, rule) {
    const line = this.line(node);
    const marker = this.markers.find(m => m.rule === rule && m.why && m.covers.includes(line));
    if (marker) marker.used = true;
    return !!marker;
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
    this.hooksDeclared = new Set();
    for (const text of this.text.values()) {
      for (const m of text.matchAll(/\b(?:function|const|let)\s+(use[A-Z][\w$]*)\b/g)) this.hooksDeclared.add(m[1]);
    }
    this.switchCache = new Map();
    this.marksCache = new Map();
    this.scopeHooks = this.#hooksCalling(new Set([SCOPE_HOOK]), text => text.includes(SCOPE_HOOK));
    this.dataHooks = this.#hooksCalling(
      new Set(),
      text => /\b(?:function|const|let)\s+use[A-Z]/.test(text),
      QUERY_HOOK,
    );
    this.suspendingHooks = this.#hooksCalling(
      new Set(),
      text => /\b(?:useLazyLoadQuery|usePreloadedQuery|useSuspenseQuery|useSuspenseQueries)\b/.test(text),
      SUSPENDING_READ,
    );
    this.deprecated = this.#deprecatedSkeletons();
  }

  /** Whether a hook returns read data: it calls a query (directly or through a data hook), or is not declared here. */
  isDataHook(name) {
    if (!/^use[A-Z]/.test(name) || NOT_DATA_HOOK.test(name) || this.scopeHooks.has(name) || LOCAL_HOOK.test(name))
      return false;
    return QUERY_HOOK.test(name) || this.dataHooks.has(name) || !this.hooksDeclared.has(name);
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

  /**
   * The `use*` hooks whose body calls one of `hooks` (or a callee matching `seed`), to a fixed point: the scope hooks
   * (`useLoadingScope` and every hook calling it) and the data hooks (every hook calling a query).
   */
  #hooksCalling(hooks, candidate, seed = null) {
    const paths = [...this.text].filter(([, text]) => candidate(text)).map(([path]) => path);
    for (let round = 0; round < 4; round++) {
      const before = hooks.size;
      for (const path of paths) {
        walk(this.parse(path), n => {
          if (!isFunctionLike(n)) return undefined;
          const name = functionName(n);
          if (/^use[A-Z]/.test(name) && !hooks.has(name) && this.#callsHook(n, hooks, seed)) hooks.add(name);
          return undefined;
        });
      }
      if (hooks.size === before) break;
    }
    return hooks;
  }

  #callsHook(fn, hooks, seed = null) {
    let found = false;
    const body = bodyOf(fn);
    if (!body) return false;
    walk(body, n => {
      if (found) return false;
      if (n !== fn && isFunctionLike(n) && isComponentName(functionName(n))) return false;
      if (ts.isCallExpression(n)) {
        const callee = dottedName(n.expression).split('.').pop();
        if (hooks.has(callee) || seed?.test(callee)) found = true;
        if (!seed && callee === 'useContext' && /LoadingScope/.test(n.arguments[0]?.getText() ?? '')) found = true;
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

  /**
   * Whether component `local` (as named in `fromPath`) carries the `kind` mark (`item`: `data-loading-item`,
   * `loadingItemProps(…)`, `listItem(s)`; `optional`: `data-loading-optional`) on an element it renders, read from its
   * declaration's AST through its import (a comment or a string that mentions the mark is not one).
   */
  componentMarks(fromPath, local, kind, depth = 0) {
    const key = `${fromPath}\0${local}\0${kind}`;
    if (this.marksCache.has(key)) return this.marksCache.get(key);
    this.marksCache.set(key, false);
    const model = this.model(fromPath);
    const binding = model.binding(local);
    let targets = [];
    if (binding?.kind === 'import') {
      const files = binding.file ? [binding.file] : [...(this.declaredIn.get(binding.imported) ?? [])];
      targets = files.map(path => [
        path,
        binding.imported === 'default' ? this.#defaultExport(path) : binding.imported,
      ]);
    } else targets = [[fromPath, local]];
    const result = targets.some(([path, name]) => {
      const decl = name && this.declarationIn(path, name);
      if (!decl) return false;
      const fn = decl.kind === 'function' ? decl.node : decl.init ? (functionInside(decl.init) ?? decl.init) : null;
      if (!fn) return false;
      const target = !isFunctionLike(fn) && decl.init ? aliasTarget(decl.init) : null;
      if (target && depth < 3) return this.componentMarks(path, target, kind, depth + 1);
      return this.#marksIn(fn, path, kind, depth);
    });
    this.marksCache.set(key, result);
    return result;
  }

  #marksIn(node, path, kind, depth) {
    const attr = kind === 'item' ? ITEM_MARK_ATTR : /^data-loading-optional$/;
    let hit = false;
    walk(node, n => {
      if (hit) return false;
      if (ts.isJsxAttribute(n) && attr.test(n.name.getText())) hit = true;
      if (kind === 'item' && ts.isCallExpression(n) && /(?:^|\.)loadingItemProps$/.test(dottedName(n.expression)))
        hit = true;
      // An element it renders whose own component carries the mark (`<Row {...props} />` → Row's root).
      const tag = renderedTag(n);
      if (!hit && tag && depth < 3) {
        const name = dottedName(tag);
        if (isComponentName(name) && this.componentMarks(path, name.split('.')[0], kind, depth + 1)) hit = true;
      }
      return undefined;
    });
    return hit;
  }

  /** Whether component `local` (as named in `fromPath`) renders nothing: every return of its declaration is nullish. */
  rendersNothing(fromPath, local) {
    const binding = this.model(fromPath).binding(local);
    const targets =
      binding?.kind === 'import'
        ? (binding.file ? [binding.file] : [...(this.declaredIn.get(binding.imported) ?? [])]).map(path => [
            path,
            binding.imported === 'default' ? this.#defaultExport(path) : binding.imported,
          ])
        : [[fromPath, local]];
    return targets.some(([path, name]) => {
      const decl = name && this.declarationIn(path, name);
      const fn = decl?.kind === 'function' ? decl.node : decl?.init ? functionInside(decl.init) : null;
      if (!fn?.body) return false;
      if (!ts.isBlock(fn.body)) return isNullish(fn.body);
      let returns = 0;
      let nothing = true;
      walk(fn.body, n => {
        if (isFunctionLike(n)) return false;
        if (ts.isReturnStatement(n)) {
          returns++;
          if (n.expression && !isNullish(n.expression)) nothing = false;
        }
        return undefined;
      });
      return returns > 0 && nothing;
    });
  }

  /** The name a module's default export is declared by, or null. */
  #defaultExport(path) {
    for (const st of this.parse(path).statements) {
      if (
        (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st)) &&
        st.modifiers?.some(m => m.kind === ts.SyntaxKind.DefaultKeyword)
      )
        return st.name?.text ?? null;
      if (ts.isExportAssignment(st) && ts.isIdentifier(strip(st.expression))) return strip(st.expression).text;
    }
    return null;
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
    // A flag or an action of a hook's result (`test.showResults`, `q.isLoading`) is not its data.
    if (ts.isPropertyAccessExpression(n) && (FLAG_FIELD.test(n.name.text) || NOT_DATA_FIELD.test(n.name.text)))
      return false;
    return isReadData(n.expression, model, { hookOnly });
  }
  if (!ts.isIdentifier(n)) return false;
  const decl = model.lookup(n.text, n);
  const fromHook =
    decl?.kind === 'var' &&
    decl.init &&
    ts.isCallExpression(strip(decl.init)) &&
    /^use[A-Z]/.test(dottedName(strip(decl.init).expression).split('.').pop());
  if (decl?.kind === 'var' && decl.init && readOrigin(n.text, decl, model)) return true;
  if (!READ_DATA.test(n.text)) return false;
  const derived =
    decl?.kind === 'var' &&
    decl.init &&
    (!ts.isCallExpression(strip(decl.init)) || LOCAL_HOOK.test(dottedName(strip(decl.init).expression)));
  if (derived) return false;
  if (hookOnly) return fromHook || !decl;
  return n.text === 'data' || fromHook || !decl || decl.kind === 'param';
}

/**
 * Whether a local holds READ DATA by where it comes from: what a data hook returns (`const { tickets } =
 * useTickets()`, `const user = useUser()`; not a flag, an error or an action of it), or an alias of read data
 * (`const user = query.data`).
 */
function readOrigin(name, decl, model, depth = 0) {
  const init = strip(decl.init);
  if (ts.isCallExpression(init)) {
    const hook = dottedName(init.expression).split('.').pop();
    if (!model.project.isDataHook(hook)) return false;
    if (!decl.destructured) return true;
    const el = bindingElement(decl.node.name, name);
    const field = el ? (el.propertyName ?? el.name).getText() : name;
    return !LOADING_FLAG.test(field) && !NOT_DATA_FIELD.test(field) && !el?.initializer && !el?.dotDotDotToken;
  }
  if (decl.destructured || depth > 3) return false;
  return (
    (ts.isPropertyAccessExpression(init) || ts.isElementAccessExpression(init) || ts.isIdentifier(init)) &&
    isReadData(init, model)
  );
}

/** The binding element that binds `name` in a destructuring pattern, or null. */
function bindingElement(pattern, name) {
  if (!ts.isObjectBindingPattern(pattern) && !ts.isArrayBindingPattern(pattern)) return null;
  for (const el of pattern.elements) {
    if (ts.isOmittedExpression(el)) continue;
    if (ts.isIdentifier(el.name) && el.name.text === name) return el;
    const inner = bindingElement(el.name, name);
    if (inner) return inner;
  }
  return null;
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

/** The operands of an `&&` chain (`a && b && c` -> [a, b, c]). */
function conjuncts(node) {
  const n = strip(node);
  if (ts.isBinaryExpression(n) && n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
    return [...conjuncts(n.left), ...conjuncts(n.right)];
  return [n];
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
      if (
        SUSPENDING_READ.test(callee) ||
        model.project.suspendingHooks.has(callee) ||
        model.project.scopeHooks.has(callee)
      )
        answered = true;
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
    if (isFunctionLike(p) && isSkeletonFunctionName(functionName(p))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------------------------------------------------------

const COUNT_ORDER = ['ok', 'unnamed', 'typed', 'cap'];
const worst = list => list.reduce((a, b) => (COUNT_ORDER.indexOf(b) > COUNT_ORDER.indexOf(a) ? b : a), 'ok');

const ARITHMETIC = new Set([
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskToken,
  ts.SyntaxKind.SlashToken,
  ts.SyntaxKind.PercentToken,
]);

const EQUALITY = new Set([
  ts.SyntaxKind.EqualsEqualsToken,
  ts.SyntaxKind.EqualsEqualsEqualsToken,
  ts.SyntaxKind.ExclamationEqualsToken,
  ts.SyntaxKind.ExclamationEqualsEqualsToken,
]);

/**
 * What a count expression is: 'typed' (a literal), 'cap' (a capped count), 'ok' (a page size, a limit, `first` or a
 * `*_SKELETON_*` name; a caller's count passed through; the length of a list), else 'unnamed': a count that names no
 * source (a call, `rows.length + 2`, a read's `data?.total`). Locals resolve to their initializer, and a field of a local
 * object (`settings.rows`) to its value there.
 */
function classifyCount(expr, model, { attr = '', depth = 0 } = {}) {
  const n = strip(expr);
  if (!n || depth > 5) return 'ok';
  const next = e => classifyCount(e, model, { attr, depth: depth + 1 });
  if (ts.isNumericLiteral(n)) return 'typed';
  // Not a number at all: a list of row shapes (`rows={[{ width }]}`), a flag (`count={n !== undefined}`), nothing.
  if (!isNumberShaped(n)) return 'ok';
  if (
    ts.isBinaryExpression(n) &&
    (n.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)
  )
    return ts.isNumericLiteral(strip(n.right))
      ? strip(n.right).text === '0'
        ? next(n.left)
        : 'typed'
      : worst([n.left, n.right].filter(b => !isNullish(b)).map(next));
  // Arithmetic on a count: a named count or a caller's count scaled or split (`PAGE_SIZE * 2`, `rows - 1`) is that
  // count; anything else is unnamed (`rows.length + 2` draws two typed rows while the list is empty).
  if (ts.isBinaryExpression(n) && ARITHMETIC.has(n.operatorToken.kind)) {
    const operands = [n.left, n.right].map(strip);
    const counts = operands.filter(o => !ts.isNumericLiteral(o));
    if (counts.length && counts.every(o => namesCount(o, model) && next(o) === 'ok')) return 'ok';
    // What is left of a named count (`pageSize - items.length`: the rest of the page) is that count.
    if (n.operatorToken.kind === ts.SyntaxKind.MinusToken && namesCount(n.left, model) && next(n.left) === 'ok')
      return 'ok';
    return worst([...counts.map(next), 'unnamed']);
  }
  if (ts.isConditionalExpression(n)) {
    // A cap: `PAGE_SIZE > 6 ? 6 : PAGE_SIZE`, or a literal against a page size. Two literals (`isMobile ? 3 : 10`)
    // are two typed counts.
    const branches = [n.whenTrue, n.whenFalse].map(strip);
    if (isComparison(n.condition)) return 'cap';
    if (branches.some(b => ts.isNumericLiteral(b)) && branches.some(b => COUNT_SOURCE_NAME.test(leafName(b))))
      return 'cap';
    // Two literals choose between two forms, unless the choice is the screen's width or the count a skeleton count.
    if (branches.every(b => ts.isNumericLiteral(b)) && !attr && !WIDTH_TEST.test(n.condition.getText())) return 'ok';
    return worst([n.whenTrue, n.whenFalse].map(next));
  }
  if (ts.isCallExpression(n)) {
    const callee = dottedName(n.expression);
    if (callee === 'Math.min' && isPageCap(n, model)) return 'cap';
    // `Math.min(PAGE_SIZE, rows.length)` (the last page), a clamp: named when one of its arguments is.
    if (callee === 'Math.min' || callee === 'Math.max')
      return n.arguments.some(a => next(a) === 'ok') ? 'ok' : 'unnamed';
    return COUNT_SOURCE_NAME.test(callee.split('.').pop() ?? '') ? 'ok' : 'unnamed';
  }
  if (ts.isPropertyAccessExpression(n) && n.name.text === 'length') {
    const of = strip(n.expression);
    if (!ts.isIdentifier(of) || COUNT_SOURCE_NAME.test(of.text)) return 'ok';
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
    const local = decl?.kind === 'var' && !!decl.init && !decl.destructured;
    if (COUNT_SOURCE_NAME.test(name)) {
      // A declared page size, limit or `*_SKELETON_*` name is the source, whatever it is set from, unless it caps.
      return local && ts.isIdentifier(n) && next(decl.init) === 'cap' ? 'cap' : 'ok';
    }
    // The same name as the count it fills (`skeletonRows={skeletonRows}`), not set here: a pass-through.
    if (attr && name === attr && !local) return 'ok';
    if (local) {
      if (ts.isIdentifier(n)) return next(decl.init);
      // A field of a local object (`const settings = { rows: 4 }` -> `settings.rows`) is its value there.
      const value = objectField(decl.init, propertyPath(n));
      if (value) return next(value);
    }
    // A skeleton-count field of something read (`scroll.skeletonRows`): checked where its key is set.
    if (ts.isPropertyAccessExpression(n) && COUNT_ATTR.test(name)) return 'ok';
    if (decl?.kind === 'import') return COUNT_SOURCE_NAME.test(decl.imported) ? 'ok' : 'unnamed';
    return 'unnamed';
  }
  return 'unnamed';
}

/** Whether an expression can be a number (not a literal list, object, string, boolean, comparison or `!x`). */
function isNumberShaped(node) {
  if (
    ts.isArrayLiteralExpression(node) ||
    ts.isObjectLiteralExpression(node) ||
    ts.isStringLiteralLike(node) ||
    ts.isTemplateExpression(node) ||
    ts.isTypeOfExpression(node) ||
    node.kind === ts.SyntaxKind.TrueKeyword ||
    node.kind === ts.SyntaxKind.FalseKeyword ||
    (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
  )
    return false;
  return !(ts.isBinaryExpression(node) && (isComparison(node) || EQUALITY.has(node.operatorToken.kind)));
}

/** Whether an operand of count arithmetic is a count itself: a caller's (a prop) or one named as a source. */
function namesCount(node, model) {
  const n = strip(node);
  if (ts.isBinaryExpression(n) && ARITHMETIC.has(n.operatorToken.kind)) return true;
  if (!ts.isIdentifier(n) && !ts.isPropertyAccessExpression(n)) return false;
  // The length of a list (`rows.length`) is what is read, empty while loading: not a count to scale.
  if (leafName(n) === 'length') return false;
  if (COUNT_SOURCE_NAME.test(leafName(n))) return true;
  const root = chainRoot(n);
  return !!root && model.lookup(root.text, root)?.kind === 'param';
}

/** The field names of a property access below its root (`a.b.c` -> `['b', 'c']`). */
function propertyPath(node) {
  const path = [];
  let n = strip(node);
  while (n && ts.isPropertyAccessExpression(n)) {
    path.unshift(n.name.text);
    n = strip(n.expression);
  }
  return path;
}

/** The value of `path` in an object literal (`{ a: { b: 4 } }`, `['a', 'b']` -> `4`), or null. */
function objectField(init, path) {
  let value = strip(init);
  for (const key of path) {
    if (!value || !ts.isObjectLiteralExpression(value)) return null;
    const prop = value.properties.find(
      q =>
        (ts.isPropertyAssignment(q) || ts.isShorthandPropertyAssignment(q)) &&
        q.name.getText().replace(/['"]/g, '') === key,
    );
    if (!prop) return null;
    value = strip(ts.isPropertyAssignment(prop) ? prop.initializer : prop.name);
  }
  return value;
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

/**
 * `Math.min(pageSize, X)` where X is a fold, a constant, a number or a local holding one (`rowsShown = 6`); not the last
 * page (`rows.length`, `total`).
 */
function isPageCap(call, model) {
  const args = call.arguments.map(a => a.getText().trim());
  const page = args.find(a => PAGE_ARG.test(a));
  if (!page) return false;
  return call.arguments.some((arg, i) => {
    const text = args[i];
    if (text === page) return false;
    if ((/^[\w$.]+$/.test(text) || CAP_NAME.test(text)) && isCapArg(text)) return true;
    const n = strip(arg);
    if (!ts.isIdentifier(n)) return false;
    if (CAP_NAME.test(n.text)) return true;
    const decl = model.lookup(n.text, n);
    return decl?.kind === 'var' && !decl.destructured && !!decl.init && ts.isNumericLiteral(strip(decl.init));
  });
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

/** `[0, 1, 2]` / `[1, 2, 3, 4]`: a list of indexes standing for N items (not a table of widths or line counts). */
function isIndexList(node) {
  const first = node.elements[0];
  const base = first && ts.isNumericLiteral(first) ? Number(first.text) : NaN;
  return (
    node.elements.length > 1 &&
    (base === 0 || base === 1) &&
    node.elements.every((e, i) => ts.isNumericLiteral(e) && Number(e.text) === base + i)
  );
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
  return model.project.componentMarks(model.path, tag.split('.')[0], 'item');
}

/** The first `.map(cb)` inside `node` (not inside a nested function), or null. */
function firstMap(node) {
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
  visit(node);
  return found;
}

/**
 * The `.map(cb)` of the loaded list beside a loading list: the other branch of the same condition, or the list the
 * component returns after `if (loading) return …` (or in its `else`).
 */
function loadedListBeside(listNode, model) {
  let child = listNode;
  for (let p = listNode.parent; p && !isFunctionLike(p); child = p, p = p.parent) {
    if (ts.isConditionalExpression(p) && (isLoadingFlag(p.condition, model) || isNegatedLoading(p.condition, model))) {
      const other = child === p.whenTrue ? p.whenFalse : child === p.whenFalse ? p.whenTrue : null;
      return other ? firstMap(other) : null;
    }
    if (ts.isIfStatement(p) && child === p.thenStatement && isLoadingFlag(p.expression, model)) {
      if (p.elseStatement) return firstMap(p.elseStatement);
      const block = p.parent;
      if (!ts.isBlock(block) || !containsReturn(p.thenStatement)) return null;
      for (const st of block.statements.slice(block.statements.indexOf(p) + 1)) {
        const found = ts.isReturnStatement(st) && st.expression ? firstMap(st.expression) : null;
        if (found) return found;
      }
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------------
// The analysis
// ---------------------------------------------------------------------------------------------------------------------

/**
 * Every finding over the reported trees of `project`, as `{ rule, path, file, line, message }` (`file` is relative to
 * the finding's tree), under a config (`CONFIGS.lib`, `CONFIGS.frontend`): `rules` run, `trees` reported, `pageCode`,
 * `exempt` lifting rules from files, and `files` (absolute paths) narrowing the run.
 *
 * @param {Project} project
 * @param {{ rules?: string[], trees?: string[], pageCode?: Function, boundaries?: Record<string, string>, exempt?: Array<{ why?: string, files: RegExp, rules: string[] }>, files?: string[] }} [config]
 */
export function analyzeProject(
  project,
  { rules = ALL_RULES, trees, pageCode, boundaries = {}, exempt = [], files } = {},
) {
  const enabled = new Set(rules);
  const findings = [];
  const paths = files ?? [...project.text.keys()].filter(path => project.treeOf.get(path)?.report);
  for (const path of paths) {
    const tree = project.treeOf.get(path);
    const rel = tree ? relative(tree.dir, path) : path;
    if (trees && !trees.some(dir => rel === dir || rel.startsWith(`${dir}/`))) continue;
    const lifted = new Set(exempt.filter(e => e.files.test(rel)).flatMap(e => e.rules));
    const active = new Set([...enabled].filter(r => !lifted.has(r)));
    if (!active.size) continue;
    const isFile = other => project.text.has(join(tree?.dir ?? '', other)) || existsSync(join(tree?.dir ?? '', other));
    findings.push(...analyzeFile(project, path, active, rel, pageCode?.(rel, isFile) ?? null, boundaries));
  }
  return findings;
}

/**
 * Every finding in one file (see `analyzeProject`); `page` is the file's page-code setting, or null; `boundaries` the
 * host's own boundary components.
 */
function analyzeFile(project, path, active, rel, page, boundaries = {}) {
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
    if (inDynamicLoading(node)) return true;
    for (let p = node.parent; p; p = p.parent) {
      if (!ts.isPropertyAssignment(p) || p.name.getText() !== 'skeleton' || !ts.isObjectLiteralExpression(p.parent))
        continue;
      const render = p.parent.properties.find(q => ts.isPropertyAssignment(q) && q.name.getText() === 'render');
      if (!render) continue;
      const renders = new Set();
      walk(render.initializer, n => {
        const tag = renderedTag(n);
        if (tag) renders.add(model.resolveName(tag).replace('Chat', ''));
      });
      if (renders.has(component)) return true;
    }
    return false;
  };

  /** Report a parent drawing the loading state of `component` (ONE_SWITCH when it switches itself). */
  const parentPicks = (node, component, what) => {
    oneSwitchSites.add(node);
    if (project.componentSwitches(component))
      report(
        'ONE_SWITCH',
        node,
        `${what} outside ${component}'s module, which switches itself (render <${component} />: one switch per component)`,
      );
    else
      report(
        'NO_SCOPE_SWITCH',
        node,
        `${what} outside ${component}'s module, which never switches itself (${component} should draw its own skeleton on useLoadingScope(), and this place render <${component} />)`,
      );
  };

  /**
   * A render of a component skeleton (`<YSkeleton>`, `createElement(YSkeleton)`, `{YSkeleton}` as a prop), or of a
   * loading component not named `*Skeleton` (`<XLoading />`, `<XPlaceholder />`).
   */
  const skeletonRender = (node, nameNode) => {
    const name = model.resolveName(nameNode);
    if (WHOLE_VIEW.test(name) && !project.deprecated.has(name)) {
      if (!project.declaredIn.get(name)?.has(path))
        report('WHOLE_VIEW_SKELETON', node, `<${name}> (a whole-view skeleton) rendered`);
      return;
    }
    if (
      (LOADING_COMPONENT.test(name) && !LOADING_WRAPPER.test(name)) ||
      (PLACEHOLDER_COMPONENT.test(name) && inLoadingContext(node, model))
    ) {
      const declared = project.declaredIn.get(name);
      if (declared?.size && !declared.has(path) && !exemptRender(node, name)) {
        oneSwitchSites.add(node);
        report(
          'NO_SCOPE_SWITCH',
          node,
          `<${name}> picked as a loading state (the component it stands for should draw its own skeleton on useLoadingScope(), and this place render it)`,
        );
      }
      return;
    }
    if (!isComponentSkeletonName(name)) return;
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
    if (PRIMITIVE.test(name)) return;
    const modules = project.declaredIn.get(component);
    const skeletonFn = enclosingNames(node).find(isSkeletonFunctionName);
    if (!modules?.size) {
      // A skeleton with no component of its own, chosen by a parent: a loading state drawn by the parent.
      const own = project.declaredIn.get(name);
      // A part of a component family (declared in the same folder) is the family's own.
      const family = [...(own ?? [])].some(d => dirname(d) === dirname(path));
      if (!skeletonFn && own?.size && !family && !project.deprecated.has(name) && !exemptRender(node, component)) {
        oneSwitchSites.add(node);
        report(
          'NO_SCOPE_SWITCH',
          node,
          `<${name}> picked as a loading state with no component of its own (draw the component the skeleton stands for, in a loading scope)`,
        );
      }
      return;
    }
    const own = new Set([...modules, ...(project.declaredIn.get(name) ?? [])]);
    if (own.has(path)) return;
    if (exemptRender(node, component)) return;
    if (skeletonFn) {
      if (rendersOutsideSkeletons(model, component) && project.componentSwitches(component)) {
        oneSwitchSites.add(node);
        report(
          'ONE_SWITCH',
          node,
          `<${name}> rendered by ${skeletonFn}, while this module renders <${component} />, which switches itself (render <${component} /> in ${skeletonFn} too: one switch per component)`,
        );
      }
      return;
    }
    parentPicks(node, component, `<${name}> rendered`);
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
      if (isComponentName(name) && !isSkeletonFunctionName(name)) components.push(node);
      // Literal count defaults: `skeletonRows = 8` anywhere, `rows = 6` / `count = 6` / `steps = 6` in a `*Skeleton`.
      checkCountDefaults(node, isSkeletonFunctionName(name));
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
    if (ts.isIdentifier(node) && isRetiredName(node.text)) {
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
      if ((WAIT_TEXT.test(text) || WAIT_ELLIPSIS.test(text)) && !inAnnouncement(node))
        report('LOADING_TEXT', node, `"${text}" as a loading state (draw the component skeleton)`);
    }
    // An inline animation of one's own (`style={{ animation: 'pulse 2s infinite' }}`).
    if (
      ts.isPropertyAssignment(node) &&
      /^(?:animation|animationName)$/.test(node.name.getText().replace(/['"]/g, '')) &&
      stringsIn(node.initializer).some(s => /\b(?:pulse|spin)\b/.test(s))
    )
      report('OWN_PULSE', node, 'an inline pulse or spin animation of its own (use the lib skeletons)');
    // A count typed in an object (`{ skeletonRows: 5, loadingRows: { primary: 7 } }`).
    if (ts.isPropertyAssignment(node) && COUNT_ATTR.test(node.name.getText().replace(/['"]/g, ''))) {
      const value = strip(node.initializer);
      const values = ts.isObjectLiteralExpression(value)
        ? value.properties.filter(ts.isPropertyAssignment).map(q => q.initializer)
        : [value];
      for (const v of values) {
        const kind = classifyCount(v, model, { attr: node.name.getText() });
        if (kind === 'typed')
          report(
            'TYPED_COUNT',
            v,
            `a typed skeleton count (${node.name.getText()}: ${v.getText()}); name the list's page size, limit or a *_SKELETON_* constant`,
          );
        else if (kind === 'cap')
          report(
            'COUNT_CAP',
            v,
            `a capped skeleton count (${node.name.getText()}: ${v.getText()}); a list's skeleton draws its full page`,
          );
      }
    }

    // --- JSX elements ------------------------------------------------------------------------------------------------
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) checkElement(node);
    if (ts.isJsxAttribute(node)) checkAttribute(node);

    // --- calls ---------------------------------------------------------------------------------------------------------
    if (ts.isCallExpression(node)) {
      const callee = dottedName(node.expression);
      const tag = renderedTag(node);
      if (tag) {
        skeletonRender(node, tag);
        if (LOADERS.has(model.resolveName(tag))) report('LOADER_COMPONENT', node, RULES.LOADER_COMPONENT);
      }
      if (isDynamicCall(node)) checkDynamic(node);
      if (callee === 'Math.min' && isPageCap(node, model) && !isClamp(node))
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
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.BarBarToken) checkOrPart(node);

    ts.forEachChild(node, visit);
  };

  /**
   * A literal default on a count: `skeletonRows = 8` / `skeletonCount = 8` anywhere, `rows` / `count` / `steps` in a
   * `*Skeleton`, and ANY parameter (a prop, or a field destructured from the props) whose value reaches a skeleton count
   * in the function (`LoadingItems`' `count`, a skeleton count prop, the length of a list drawn while loading, a
   * `skeletonCount:` key).
   */
  function checkCountDefaults(fn, inSkeleton) {
    const defaults = [];
    const collect = binding => {
      if (ts.isObjectBindingPattern(binding)) {
        for (const el of binding.elements) {
          if (el.initializer && ts.isIdentifier(el.name))
            defaults.push({ key: (el.propertyName ?? el.name).getText(), name: el.name.text, el });
        }
      }
    };
    for (const param of fn.parameters) {
      if (ts.isIdentifier(param.name) && param.initializer)
        defaults.push({ key: param.name.text, name: param.name.text, el: param });
      collect(param.name);
    }
    // `const { rows = 6 } = props`: a field of the props.
    const body = bodyOf(fn);
    for (const st of body && ts.isBlock(body) ? body.statements : []) {
      if (!ts.isVariableStatement(st)) continue;
      for (const d of st.declarationList.declarations) {
        const init = d.initializer && strip(d.initializer);
        if (init && ts.isIdentifier(init) && model.lookup(init.text, init)?.kind === 'param') collect(d.name);
      }
    }
    // A literal other than 0 (a default of none draws nothing).
    const literals = defaults.filter(d => {
      const init = d.el.initializer && strip(d.el.initializer);
      return !!init && ts.isNumericLiteral(init) && init.text !== '0';
    });
    if (!literals.length) return;
    const reached = countNamesIn(fn);
    for (const { key, name, el } of literals) {
      if (
        /^(?:skeletonRows|skeletonCount)$/.test(key) ||
        (inSkeleton && /^(?:count|rows|steps)$/.test(key)) ||
        reached.has(name)
      )
        report(
          'TYPED_COUNT',
          el,
          `a literal default for ${key}, which a skeleton count draws (name the page size, limit or a *_SKELETON_* constant)`,
        );
    }
  }

  /** The names (parameters and props of `fn`, through its locals) that a skeleton count in `fn` reads. */
  function countNamesIn(fn) {
    const names = new Set();
    const read = (expr, depth = 0) => {
      const visitName = n => {
        if (!ts.isIdentifier(n)) return undefined;
        const decl = model.lookup(n.text, n);
        if (decl?.kind === 'param') names.add(n.text);
        else if (decl?.kind === 'var' && decl.init && depth < 3 && nearestFunction(decl.node) === fn) {
          names.add(n.text);
          if (!decl.destructured) read(decl.init, depth + 1);
        }
        return undefined;
      };
      visitName(strip(expr));
      walk(expr, visitName);
    };
    walk(fn, n => {
      if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = model.resolveName(n.tagName);
        for (const a of n.attributes.properties) {
          if (ts.isJsxAttribute(a) && attributeExpression(a) && isCountAttribute(tag, a.name.getText()))
            read(attributeExpression(a));
        }
      }
      if (ts.isPropertyAssignment(n) && COUNT_ATTR.test(n.name.getText().replace(/['"]/g, ''))) read(n.initializer);
      const list = listOf(n, model);
      if (list?.count && !list.literalArray) {
        const countName = leafName(list.count);
        // The cells of one row and a text's lines are not list items.
        if (!isCellCount(countName) && !isTextLineCount(countName) && inLoadingContext(n, model)) read(list.count);
      }
      return undefined;
    });
    return names;
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
    if (PULSE_CLASS.test(text))
      report(
        'OWN_PULSE',
        node,
        'a pulse or skeleton colour of its own (use the lib skeletons, LIVE_PULSE_CLASS for live dots)',
      );
    if (SPIN_CLASS.test(text)) checkSpin(node);
    const attrName = enclosingAttribute(node)?.name.getText() ?? '';
    const trimmed = text.trim();
    if (attrName === 'placeholder' && /^(?:loading|checking|fetching)\b/i.test(trimmed))
      report('LOADING_TEXT', node, `"${trimmed}" as a placeholder (draw the field in a loading scope)`);
    else if (
      WAIT_ELLIPSIS.test(trimmed) &&
      !/^(?:label|aria-label|aria-valuetext|title|alt|statusLabel|loadingLabel|placeholder)$/.test(attrName) &&
      !isAnnouncement(node) &&
      !inAnnouncement(node)
    )
      report('LOADING_TEXT', node, `"${trimmed}" as a loading state (draw the component skeleton)`);
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
    const v = (n, depth = 0) => {
      if (hit) return;
      if ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) && READ_FLAG.test(leafName(n))) {
        if (leafName(n) !== 'loading') hit = true;
        else if (ts.isIdentifier(n)) {
          const decl = model.lookup(n.text, n);
          if (decl?.kind === 'var' && decl.init && ts.isCallExpression(strip(decl.init))) hit = true;
        } else hit = true;
        if (hit) return;
      }
      // A local holding a read flag (`const busy = q.isLoading`).
      if (ts.isIdentifier(n) && depth < 3) {
        const decl = model.lookup(n.text, n);
        if (decl?.kind === 'var' && decl.init && !decl.destructured && !ts.isCallExpression(strip(decl.init)))
          v(decl.init, depth + 1);
        if (hit) return;
      }
      if (ts.isBinaryExpression(n) && isLoadingFlag(n, model) && /===|==/.test(n.operatorToken.getText())) hit = true;
      ts.forEachChild(n, c => v(c, depth));
    };
    v(test);
    return hit && !!fn;
  }

  function checkElement(opening) {
    const tag = model.resolveName(opening.tagName);
    const leaf = tag.split('.').pop();
    skeletonRender(opening, opening.tagName);
    if (LOADERS.has(leaf)) report('LOADER_COMPONENT', opening, RULES.LOADER_COMPONENT);
    if (leaf === 'StreamedPage' || leaf === 'StreamedSection') {
      for (const a of opening.attributes.properties) {
        if (ts.isJsxAttribute(a) && /^(?:skeleton|memory|remember)$/.test(a.name.getText()))
          report('RETIRED_API', a, `${leaf} \`${a.name.getText()}\` (it takes a placeholder)`);
      }
    }
    if (leaf === 'Suspense' || leaf === 'LoadingSuspense') checkFallback(opening, leaf);
    if (leaf === 'LoadingFallback' && ts.isJsxOpeningElement(opening)) {
      const children = opening.parent.children.filter(c => !(ts.isJsxText(c) && !c.text.trim()));
      if (children.every(c => (ts.isJsxExpression(c) ? !c.expression || isBlank(c.expression) : isBlank(c))))
        report('SUSPENSE_FALLBACK', opening, 'a LoadingFallback drawing nothing (render the view it stands for)');
    }
    if (leaf === 'LoadingFallback' && ts.isJsxSelfClosingElement(opening) && !attribute(opening, 'children'))
      report('SUSPENSE_FALLBACK', opening, 'a LoadingFallback drawing nothing (render the view it stands for)');
    if (leaf === 'LoadingRegion' && ts.isJsxOpeningElement(opening)) {
      let inner = '';
      walk(opening.parent, n => {
        const name = renderedTag(n) && model.resolveName(renderedTag(n));
        if (name === 'LoadingScope' || name === 'LoadingWhen') inner = name;
      });
      if (inner) report('HAND_PAIR', opening, `a hand LoadingRegion + ${inner} pair (use LoadingFallback)`);
    }
    if (PRIMITIVE.test(tag)) checkPrimitiveInBranch(opening, tag);
    // Counts on loading elements.
    for (const a of opening.attributes.properties) {
      if (!ts.isJsxAttribute(a)) continue;
      const name = a.name.getText();
      const value = attributeExpression(a);
      if (!value) continue;
      if (!isCountAttribute(tag, name)) continue;
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
      else if (kind === 'unnamed')
        report(
          'COUNT_SOURCE',
          a,
          `${name}={${value.getText()}} does not name a page size, a limit or a *_SKELETON_* constant; name where the count comes from`,
        );
      else if (pagedSkeletonCount(value, a)) reportPagedSkeletonCount(a, value);
    }
  }

  /** A `Suspense` / `LoadingSuspense` fallback that draws nothing (LoadingSuspense's own default is its children). */
  function checkFallback(opening, leaf) {
    const fallback = attribute(opening, 'fallback');
    const value = attributeExpression(fallback);
    if (!fallback) {
      if (leaf === 'Suspense')
        report('SUSPENSE_FALLBACK', opening, 'a Suspense with no fallback (use LoadingSuspense / LoadingFallback)');
      return;
    }
    if (!value || isBlank(value)) {
      report(
        'SUSPENSE_FALLBACK',
        value ?? fallback,
        `a ${leaf} fallback that draws nothing (draw the view it waits on)`,
      );
      return;
    }
    const root = rootElement(value);
    const rootOpening = root && openingOf(root);
    if (leaf !== 'Suspense') return;
    if (rootOpening && model.resolveName(rootOpening.tagName) === 'LoadingFallback')
      report('HAND_PAIR', opening, 'a hand Suspense + LoadingFallback pair (use LoadingSuspense)');
    else report('RAW_SUSPENSE', opening, RULES.RAW_SUSPENSE);
  }

  /**
   * A skeleton primitive drawn in the loading branch of `loading ? <Bars /> : <Y />` where Y is a component: the parent
   * draws Y's loading state (Y renders itself in the scope).
   */
  function checkPrimitiveInBranch(opening, tag) {
    if (enclosingNames(opening).some(isSkeletonFunctionName)) return;
    const el = ts.isJsxOpeningElement(opening) ? opening.parent : opening;
    let child = el;
    let p = el.parent;
    while (p && ts.isParenthesizedExpression(p)) [child, p] = [p, p.parent];
    if (!p || !ts.isConditionalExpression(p) || child === p.condition) return;
    const loadingTrue = isLoadingFlag(p.condition, model);
    const loadingFalse = isNegatedLoading(p.condition, model);
    const loadingHalf = loadingTrue ? p.whenTrue : loadingFalse ? p.whenFalse : null;
    if (!loadingHalf || strip(loadingHalf) !== el) return;
    const other = rootElement(loadingTrue ? p.whenFalse : p.whenTrue);
    const otherOpening = other && openingOf(other);
    if (!otherOpening) return;
    const component = model.resolveName(otherOpening.tagName);
    if (
      !isComponentName(component) ||
      component.includes('.') ||
      isSkeletonName(component) ||
      LOADING_WRAPPER.test(component)
    )
      return;
    if (!project.componentSwitches(component) && !project.declaredIn.get(`${component}Skeleton`)?.size) return;
    parentPicks(opening, component, `<${tag.split('.')[0]}> drawn in place of <${component}> while loading`);
  }

  /** Whether a `*_SKELETON_*` count is drawn by a component whose list has a page size (it draws the page). */
  function pagedSkeletonCount(count, at) {
    const name = leafName(count);
    if (!/(?:^|_)SKELETON_/.test(name)) return false;
    const fn = componentOf(at);
    if (!fn?.body) return false;
    // The component's own read is paged: a page size handed to one of its hooks (`useQuery({ … PAGE_SIZE … })`).
    let paged = false;
    walk(fn.body, n => {
      if (paged || (isFunctionLike(n) && n !== fn)) return false;
      if (ts.isCallExpression(n) && /^use[A-Z]/.test(dottedName(n.expression).split('.').pop()))
        walk(n, m => {
          if ((ts.isIdentifier(m) || ts.isPropertyAccessExpression(m)) && PAGE_SIZE_NAME.test(leafName(m)))
            paged = true;
          if (ts.isPropertyAssignment(m) && PAGE_SIZE_NAME.test(m.name.getText())) paged = true;
        });
      return undefined;
    });
    return paged;
  }

  function reportPagedSkeletonCount(at, count) {
    report(
      'COUNT_SOURCE',
      at,
      `${count.getText()} is a *_SKELETON_* count in a component whose list has a page size (a paged list draws its page size)`,
    );
  }

  function checkAttribute(attr) {
    const name = attr.name.getText();
    if (name === 'fold') report('FOLD_PROP', attr, 'a `fold` prop (a skeleton draws its full count: skeletonCount)');
    // `{YSkeleton}` handed to a prop is a parent choosing the child's skeleton.
    const value = attributeExpression(attr);
    if (value && ts.isIdentifier(strip(value))) skeletonRender(attr, value);
  }

  function checkList({ count, callback, node, loadingItems, literalArray }) {
    const item = callbackItem(callback);
    const countName = count && !literalArray ? leafName(count) : '';
    // Text: a typical line count, when each item is a skeleton line itself (a list of rows named `*LINES` is a list).
    const textLines = isTextLineCount(countName);
    if (textLines && (!item || lineItem(item))) return;
    const loading = loadingItems || inLoadingContext(node, model);
    // The cells of one row (`columns`, `cells`) are not list items: their count never changes the row's height.
    const cells = isCellCount(countName);
    if (loading && count && !loadingItems && !cells) {
      const kind = literalArray ? 'typed' : classifyCount(count, model);
      if (kind === 'typed')
        report(
          'TYPED_COUNT',
          node,
          `a typed count in ${enclosingNames(node).find(Boolean) || 'a loading branch'}; name the list's page size, limit or a *_SKELETON_* constant`,
        );
      else if (kind === 'cap')
        report('COUNT_CAP', node, `a capped skeleton list (${count.getText()}); a list's skeleton draws its full page`);
      else if (kind === 'unnamed')
        report(
          'COUNT_SOURCE',
          node,
          `a skeleton list of ${count.getText()} items; name the page size, limit or a *_SKELETON_* constant`,
        );
      else if (pagedSkeletonCount(count, node)) reportPagedSkeletonCount(node, count);
    }
    const passedCount = loading && (COUNT_ATTR.test(countName) || PASSED_COUNT.test(countName));
    const isList = !cells && (loadingItems || textLines || passedCount || COUNT_SOURCE_NAME.test(countName));
    if (loading) checkHiddenItems(callback, item);
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

  /** Whether a list item is one skeleton line (a primitive, or an element holding only one). */
  function lineItem(item) {
    const opening = openingOf(item);
    if (!opening) return false;
    if (PRIMITIVE.test(model.resolveName(opening.tagName))) return true;
    if (!ts.isJsxElement(item)) return false;
    const children = item.children.filter(c => !(ts.isJsxText(c) && !c.text.trim()));
    return (
      children.length === 1 &&
      (ts.isJsxElement(children[0]) || ts.isJsxSelfClosingElement(children[0])) &&
      PRIMITIVE.test(model.resolveName(openingOf(children[0]).tagName)) &&
      !/^(?:li|tr)$/.test(opening.tagName.getText())
    );
  }

  /** Loading items hidden per breakpoint (their class, through a constant too), or returned as nothing past the Nth. */
  function checkHiddenItems(callback, item) {
    const opening = item && openingOf(item);
    const cls = opening && attributeExpression(attribute(opening, 'className'));
    if (cls && classStrings(cls, model).some(s => BREAKPOINT_HIDDEN.test(s)))
      report(
        'HIDDEN_ITEMS',
        cls,
        'a loading item hidden per breakpoint (a skeleton draws its full count at every width)',
      );
    const cb = strip(callback);
    if (!cb || !isFunctionLike(cb)) return;
    const index = cb.parameters.map(param => param.name.getText());
    const returned = strip(returnedExpression(cb));
    if (!returned) return;
    const cond = ts.isConditionalExpression(returned)
      ? (isNullish(returned.whenTrue) || isNullish(returned.whenFalse)) && returned.condition
      : ts.isBinaryExpression(returned) && returned.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
        ? returned.left
        : null;
    if (!cond) return;
    const byIndex = n => isComparison(n) && index.some(i => new RegExp(`\\b${i}\\b`).test(n.getText()));
    let hidden = byIndex(cond);
    walk(cond, n => {
      if (byIndex(n)) hidden = true;
    });
    if (hidden)
      report('HIDDEN_ITEMS', cond, 'loading items past the Nth drawn as nothing (a skeleton draws its full count)');
  }

  // ---- nothing while loading --------------------------------------------------------------------------------------

  function componentScope(node) {
    const fn = nearestFunction(node);
    if (!fn) return null;
    return isComponentName(functionName(fn)) && !isSkeletonFunctionName(functionName(fn)) ? fn : null;
  }

  function checkIfNull(stmt) {
    if (!isTsx) return;
    const then = stmt.thenStatement;
    const ret = ts.isReturnStatement(then)
      ? then
      : ts.isBlock(then) && then.statements.length === 1 && ts.isReturnStatement(then.statements[0])
        ? then.statements[0]
        : null;
    if (!ret || !(ret.expression && isBlank(ret.expression))) return;
    const fn = componentScope(stmt);
    if (!fn) return;
    const test = stmt.expression;
    if (isScopeCall(test) && (delegatesToReader(fn) || returnsOptional(fn))) return;
    // A part some records lack (its loaded return marked `data-loading-optional`): absent while loading too.
    if (!mentionsLoading(test) && returnsOptional(fn)) return;
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

  /** `{loading || <X />}`: while loading the slot renders the flag (nothing). */
  function checkOrPart(bin) {
    if (!isJsx(bin.right)) return;
    let p = bin.parent;
    while (p && ts.isParenthesizedExpression(p)) p = p.parent;
    if (!p || !(isJsxChild(p) || ts.isReturnStatement(p) || ts.isArrowFunction(p))) return;
    if (!heldWhileLoading(bin.left, model) || offScreen(bin.right)) return;
    report('NOTHING_WHILE_LOADING', bin, 'nothing drawn while loading (`loading || <X />` renders the flag)');
  }

  /** A `next/dynamic` import with no `loading:` fallback: its slot is empty while the chunk loads. */
  function checkDynamic(call) {
    const options = strip(call.arguments[1]);
    const hasLoading =
      options &&
      ts.isObjectLiteralExpression(options) &&
      options.properties.some(q => q.name?.getText() === 'loading' || ts.isSpreadAssignment(q));
    if (hasLoading || (options && !ts.isObjectLiteralExpression(options))) return;
    let p = call.parent;
    while (p && (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isCallExpression(p))) p = p.parent;
    const name = p && ts.isVariableDeclaration(p) && ts.isIdentifier(p.name) ? p.name.text : '';
    if (OFF_SCREEN.test(name)) return;
    report(
      'NOTHING_WHILE_LOADING',
      call,
      `a next/dynamic import${name ? ` (${name})` : ''} with no loading: fallback (draw its skeleton while the chunk loads)`,
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
    // A part drawn WHILE something loads (`isLoadingMore && !isLoading && <Card loading />`) is a loading form.
    if (conjuncts(test).some(c => isLoadingFlag(c, model))) return;
    const switching = switchingComponent(bin);
    const negLoading = isNegatedLoadingIn(test);
    const readKey = !negLoading && readFieldKey(test);
    if (!negLoading && !readKey) {
      // A read keyed on hook data, in a component that does not switch.
      // Every operand must be the read (an operand of the user's own state or a prop gates the part on that instead).
      if (
        !switching &&
        fn &&
        conjuncts(test).every(c => falseWhileLoading(c, model, { hookOnly: true })) &&
        !answeredBefore(fn, bin, model) &&
        !optionalHandled(bin, bin.right) &&
        !offScreen(bin.right)
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
    if (OFF_SCREEN.test(dottedName(opening.tagName))) return true;
    if (isComponentName(dottedName(opening.tagName)) && project.rendersNothing(model.path, dottedName(opening.tagName)))
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
      model.project.componentMarks(model.path, dottedName(opening.tagName).split('.')[0], 'optional')
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
        if (isSkeletonName(tag) || /^Loading(?:Items|When|Fallback|Suspense)$/.test(tag)) hit = true;
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
      if (propDerived(test, fn) && readsFlag(test, fn))
        report('PROP_ONLY_SWITCH', n, 'a switch on the loading prop alone (switch on useLoadingScope() || loading)');
      else if (ownReadFlag(test, fn))
        report(
          'PROP_ONLY_SWITCH',
          n,
          'a switch on its own read flag alone (switch on useLoadingScope() || isLoading: inside a scope it draws the loaded form with no data)',
        );
      return undefined;
    });
  }

  /** Whether a condition reads a READ FLAG the component's own hook returns (not a context's, not the scope). */
  function ownReadFlag(test, fn, depth = 0) {
    let hit = false;
    const fromHook = init => {
      const call = strip(init);
      if (!ts.isCallExpression(call)) return false;
      const hook = dottedName(call.expression).split('.').pop();
      return (
        /^use[A-Z]/.test(hook) && !/Context$/.test(hook) && !project.scopeHooks.has(hook) && !LOCAL_HOOK.test(hook)
      );
    };
    const v = n => {
      if (hit || isFunctionLike(n)) return;
      const root = chainRoot(n);
      if ((ts.isIdentifier(n) || ts.isPropertyAccessExpression(n)) && root) {
        const decl = model.lookup(root.text, root);
        if (decl?.kind === 'var' && decl.init && nearestFunction(decl.node) === fn) {
          if (READ_FLAG.test(leafName(n)) && fromHook(decl.init)) hit = true;
          else if (ts.isIdentifier(n) && !decl.destructured && depth < 3 && ownReadFlag(decl.init, fn, depth + 1))
            hit = true;
        }
        if (hit) return;
      }
      if (ts.isBinaryExpression(n) && isLoadingFlag(n, model) && /===|==/.test(n.operatorToken.getText())) {
        const side = [n.left, n.right].map(strip).find(x => !ts.isStringLiteral(x));
        const sideRoot = side && chainRoot(side);
        const decl = sideRoot && model.lookup(sideRoot.text, sideRoot);
        if (decl?.kind === 'var' && decl.init && fromHook(decl.init)) hit = true;
      }
      ts.forEachChild(n, v);
    };
    v(test);
    return hit;
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
    return isSkeletonName(model.resolveName(opening.tagName)) ? opening : null;
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

  // ---- page code (a host's route files and screens; see `CONFIGS.frontend.pageCode`) ---------------------------------
  if (page) checkPageCode(page);

  // ---- a boundary around a whole page (a route file's page or layout) ------------------------------------------------
  if (isTsx && PAGE_OR_LAYOUT_FILE.test(rel)) checkPageBoundary();

  /** The boundary a JSX root is, by name (`Suspense`, `LoadingSuspense`, a host boundary not told to render directly). */
  function boundaryOf(el) {
    const opening = el && openingOf(el);
    if (!opening) return null;
    const leaf = model.resolveName(opening.tagName).split('.').pop();
    if (leaf === 'Suspense' || leaf === 'LoadingSuspense') return { opening, leaf };
    const direct = boundaries[leaf];
    if (direct === undefined) return null;
    const flag = attribute(opening, direct);
    const value = flag && attributeExpression(flag);
    const off = flag && (!flag.initializer || (value && value.kind === ts.SyntaxKind.TrueKeyword));
    return off ? null : { opening, leaf };
  }

  /** The element a page's output is: its root, or the only element of a root fragment. */
  function pageRoot(expr) {
    let el = rootElement(expr);
    while (el && ts.isJsxFragment(el)) {
      const kids = el.children.filter(c => !(ts.isJsxText(c) && !c.text.trim()));
      if (kids.length !== 1) return null;
      el = ts.isJsxExpression(kids[0]) ? rootElement(kids[0].expression) : kids[0];
    }
    return el;
  }

  function checkPageBoundary() {
    const fn = defaultExportFunction(model);
    if (!fn) return;
    const outputs = [];
    const collect = expr => {
      const n = strip(expr);
      if (!n) return;
      if (ts.isConditionalExpression(n)) {
        collect(n.whenTrue);
        collect(n.whenFalse);
        return;
      }
      // A render helper handed the page (`renderPlatformPage({ slots: { x: <Page /> } })`): each slot is the output.
      if (ts.isCallExpression(n)) {
        for (const arg of n.arguments)
          walk(arg, m => {
            if (isFunctionLike(m)) return false;
            if (ts.isPropertyAssignment(m) && isJsx(strip(m.initializer))) outputs.push(m.initializer);
            return undefined;
          });
        return;
      }
      outputs.push(n);
    };
    if (fn.body && !ts.isBlock(fn.body)) collect(fn.body);
    else if (fn.body)
      walk(fn.body, n => {
        if (isFunctionLike(n)) return false;
        if (ts.isReturnStatement(n) && n.expression) collect(n.expression);
        return undefined;
      });
    for (const out of outputs) {
      const hit = boundaryOf(pageRoot(out));
      if (hit)
        report(
          'PAGE_BOUNDARY',
          hit.opening,
          `<${hit.leaf}> around the whole ${/layout\.tsx$/.test(rel) ? 'layout' : 'page'} (wrap only the component that waits on a read; the static frame renders at once)`,
        );
    }
  }

  function checkPageCode({ components: componentSkeletons }) {
    if (/(?:^|\/)loading\.tsx$/.test(rel) && rel.startsWith('app/'))
      report('PAGE_CODE', model.sf, 'a route-level loading.tsx (the page draws itself in a loading scope)');
    walk(model.sf, n => {
      const tag = renderedTag(n);
      if (tag) {
        const name = model.resolveName(tag);
        if (PRIMITIVE.test(name) || PRIMITIVE.test(dottedName(tag)))
          report('PAGE_CODE', n, `${name.split('.')[0]} (a skeleton primitive in page code)`);
        else if (componentSkeletons && isSkeletonName(name) && !inDynamicLoading(n))
          report('PAGE_CODE', n, `<${name}> rendered by page code (render the component: it draws its own skeleton)`);
      }
      if ((ts.isFunctionDeclaration(n) || ts.isVariableDeclaration(n)) && n.name && ts.isIdentifier(n.name)) {
        const fnLike =
          ts.isFunctionDeclaration(n) || (n.initializer && (functionInside(n.initializer) || isJsx(n.initializer)));
        if (fnLike && isComponentSkeletonName(n.name.text))
          report('PAGE_CODE', n.name, `${n.name.text} (a component declared as a skeleton)`);
      }
      return undefined;
    });
  }

  // ---- opt-outs: only the rule-scoped form, and only one that lifts something ---------------------------------------
  if (active.has('OPT_OUT')) {
    for (const marker of model.markers) {
      const problem = !marker.rule
        ? 'an opt-out with no rule (write `// loading-standard-ok(RULE_ID): <why>`)'
        : !RULES[marker.rule] || marker.rule === 'OPT_OUT'
          ? `an opt-out naming no rule of the engine (${marker.rule})`
          : !marker.why
            ? `an opt-out of ${marker.rule} with no reason`
            : !active.has(marker.rule)
              ? `an opt-out of ${marker.rule}, which does not run on this file (delete it)`
              : !marker.used
                ? `an opt-out of ${marker.rule} that lifts nothing (delete it)`
                : null;
      if (problem) findings.push({ rule: 'OPT_OUT', path, file: rel, line: marker.line, message: problem });
    }
  }

  return findings;
}

/** The function a module exports as its default (`export default function`, or `export default Name`), or null. */
function defaultExportFunction(model) {
  for (const st of model.sf.statements) {
    const mods = ts.canHaveModifiers?.(st) ? (ts.getModifiers(st) ?? []) : (st.modifiers ?? []);
    const isDefault = mods.some(m => m.kind === ts.SyntaxKind.DefaultKeyword);
    if (ts.isFunctionDeclaration(st) && isDefault) return st;
    if (ts.isExportAssignment(st) && !st.isExportEquals) {
      const e = strip(st.expression);
      if (isFunctionLike(e)) return e;
      if (ts.isIdentifier(e)) {
        for (const other of model.sf.statements) {
          if (ts.isFunctionDeclaration(other) && other.name?.text === e.text) return other;
          if (ts.isVariableStatement(other))
            for (const d of other.declarationList.declarations)
              if (
                ts.isIdentifier(d.name) &&
                d.name.text === e.text &&
                d.initializer &&
                isFunctionLike(strip(d.initializer))
              )
                return strip(d.initializer);
        }
      }
    }
  }
  return null;
}

/** Whether `model`'s module renders `<component />` from a function that is not a skeleton. */
function rendersOutsideSkeletons(model, component) {
  let hit = false;
  walk(model.sf, n => {
    if (hit) return false;
    const tag = renderedTag(n);
    if (tag && model.resolveName(tag) === component && !enclosingNames(n).some(isSkeletonFunctionName)) hit = true;
    return undefined;
  });
  return hit;
}

/** `path:line: message` lines, sorted by path then line. */
export function formatFindings(findings, { separator = ': ' } = {}) {
  return [...findings]
    .sort((a, b) => (a.file === b.file ? a.line - b.line : a.file < b.file ? -1 : 1))
    .map(f => `${f.file}:${f.line}${separator}${f.message} [${f.rule}]`);
}
