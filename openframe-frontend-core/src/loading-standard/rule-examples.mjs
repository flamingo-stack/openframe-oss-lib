/**
 * One failing and one passing example per rule of the loading-standard engine (`engine.mjs`), as small source trees
 * (paths relative to a `src/` folder). The lib's test and every host's gate test run them through their own entry
 * point, so a rule that stops failing what it names (or starts failing the form the standard asks for) is caught on
 * both sides. `rule` is the engine's rule id (`PAGE_CODE` runs on the files a config's `pageCode` names: the
 * frontend's route files under `app/`).
 */

const CHILD = `import { useLoadingScope } from '@flamingo-stack/openframe-frontend-core';
export function Child({ loading }: { loading?: boolean }) {
  const isLoading = useLoadingScope() || loading;
  if (isLoading) return <ChildSkeleton />;
  return <b />;
}
export function ChildSkeleton() { return <i />; }
`;

const component = body => `export function Thing({ loading, rows, record }: any) {\n${body}\n}\n`;
const switching = body =>
  `export function Thing({ loading, rows, record }: any) {\n  const isLoading = useLoadingScope() || loading;\n${body}\n}\n`;

/**
 * A rule may have more than one example: each names (`name`) the form it pins. Every failing tree must report its rule,
 * every passing tree must not.
 *
 * @type {Array<{ rule: string, name?: string, fail: Record<string, string>, pass: Record<string, string> }>}
 */
export const RULE_EXAMPLES = [
  {
    rule: 'ONE_SWITCH',
    fail: {
      'components/child/child.tsx': CHILD,
      'components/parent/parent.tsx': `import { ChildSkeleton as Bars } from '../child/child';
const Placeholder = Bars;
export function Parent({ isLoading }: { isLoading: boolean }) {
  return isLoading ? <Placeholder /> : <Child />;
}
`,
    },
    pass: {
      'components/child/child.tsx': CHILD,
      'components/parent/parent.tsx': `import dynamic from 'next/dynamic';
import { Child } from '../child/child';
const Lazy = dynamic(() => import('../child/child'), { loading: () => <ChildSkeleton /> });
export function Parent({ isLoading }: { isLoading: boolean }) {
  return <LoadingWhen loading={isLoading}><Child /><Lazy /></LoadingWhen>;
}
`,
    },
  },
  {
    rule: 'NO_SCOPE_SWITCH',
    fail: {
      'components/pill/pill.tsx':
        'export function Pill() { return <b />; }\nexport function PillSkeleton() { return <i />; }\n',
      'components/card/card.tsx':
        "import { PillSkeleton } from '../pill/pill';\nexport function Card() { return createElement(PillSkeleton); }\n",
    },
    pass: {
      'components/pill/pill.tsx':
        'export function Pill() { return <b />; }\nexport function PillSkeleton() { return <i />; }\n',
      'components/card/card.tsx': "import { Pill } from '../pill/pill';\nexport function Card() { return <Pill />; }\n",
    },
  },
  {
    rule: 'PROP_ONLY_SWITCH',
    fail: {
      'components/own.tsx': `export function Own(props: { pending: boolean }) {
  if (props.pending) {
    return <OwnSkeleton />;
  }
  return <b />;
}
function OwnSkeleton() { return <i />; }
export function Sibling() { return useLoadingScope() ? <i /> : <b />; }
`,
    },
    pass: {
      'components/own.tsx': `export function Own({ pending, title }: { pending: boolean; title?: string }) {
  const loading = useLoadingScope() || pending;
  if (loading) return <OwnSkeleton />;
  return <b>{title}</b>;
}
export function Table() {
  const { loading } = useTableContext();
  return loading ? <RowSkeleton /> : <Row />;
}
function OwnSkeleton() { return <i />; }
`,
    },
  },
  {
    rule: 'NOTHING_WHILE_LOADING',
    fail: {
      'components/nothing.tsx': `export function Q({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return null;
  }
  return <b />;
}
export function Q2() {
  const { data } = useQuery();
  if (!data?.items) return null;
  return <b />;
}
export function Q3({ query }: any) {
  return (
    <div>
      {query.isLoading ? null : (
        <X />
      )}
    </div>
  );
}
`,
    },
    pass: {
      'components/nothing.tsx': `export function Q() {
  const data = useLazyLoadQuery(q, {});
  if (!data.node) return null;
  return <b />;
}
export function Q2({ loading, error }: any) {
  if (loading) return <Q2Skeleton />;
  if (!data) return null;
  return <div>{error ? <LoadError /> : null}{value}</div>;
}
export function Gate() {
  if (useLoadingScope()) return null;
  return <ThingQuery />;
}
export function Quotes({ quotes }: any) {
  if (useLoadingScope()) return null;
  return <aside data-loading-optional>{quotes.length}</aside>;
}
export function Enrich({ loading, hint }: any) {
  return (
    <div>
      <Button loading={loading} onClick={run}>Enrich</Button>
      {hint && !loading && <p>{hint}</p>}
    </div>
  );
}
`,
    },
  },
  {
    rule: 'SPINNER',
    fail: {
      'components/spin.tsx': `export function S({ isLoading }: { isLoading: boolean }) {
  return (
    <div>
      {isLoading && (
        <Loader2 className="h-4 w-4 animate-spin" />
      )}
      <span className={cn('animate-spin', 'h-4')} />
    </div>
  );
}
`,
    },
    pass: {
      'components/spin.tsx': `export function Save({ isSubmitting }: { isSubmitting: boolean }) {
  return <Button>{isSubmitting && <Loader2 className="animate-spin" />}Save</Button>;
}
`,
    },
  },
  {
    rule: 'LOADER_COMPONENT',
    fail: {
      'components/loader.tsx': `import { CompactPageLoader as Wait } from '@flamingo-stack/openframe-frontend-core';
export function L({ loading }: { loading: boolean }) { return loading ? <Wait /> : <List />; }
`,
    },
    pass: {
      'components/loader.tsx':
        'export function L({ loading }: { loading: boolean }) { return <LoadingWhen loading={loading}><List /></LoadingWhen>; }\n',
    },
  },
  {
    rule: 'LOADING_TEXT',
    fail: {
      'components/text.tsx': `export function T() {
  return (
    <div>
      <p>
        Loading devices…
      </p>
      <Input placeholder="Loading tags" />
    </div>
  );
}
`,
    },
    pass: {
      'components/text.tsx': `export function T() {
  return (
    <LoadingSuspense label="Loading devices…">
      <span role="status" className="sr-only">Loading devices</span>
      <Devices />
    </LoadingSuspense>
  );
}
`,
    },
  },
  {
    rule: 'OWN_PULSE',
    fail: {
      'components/pulse.tsx': 'export function P() { return <div className="animate-[pulse_2s_infinite]" />; }\n',
    },
    pass: { 'components/pulse.tsx': 'export function P() { return <TextLineSkeleton type="h4" />; }\n' },
  },
  {
    rule: 'SUSPENSE_FALLBACK',
    fail: {
      'components/su.tsx': `export function Su() {
  return (
    <>
      <React.Suspense>
        <X />
      </React.Suspense>
      <Suspense fallback={<></>}>
        <X />
      </Suspense>
    </>
  );
}
`,
    },
    pass: {
      'components/su.tsx':
        'export function Su() { return <LoadingSuspense label="Loading X" fallback={<XView x={null} />}><X /></LoadingSuspense>; }\n',
    },
  },
  {
    rule: 'HAND_PAIR',
    fail: {
      'components/pair.tsx': `export function Pair() {
  return (
    <>
      <Suspense fallback={<LoadingFallback label="Loading X"><XView x={null} /></LoadingFallback>}><X /></Suspense>
      <LoadingRegion label="Loading tags"><LoadingScope><Tags /></LoadingScope></LoadingRegion>
    </>
  );
}
`,
    },
    pass: {
      'components/pair.tsx': `export function Pair() {
  return (
    <>
      <LoadingSuspense label="Loading X" fallback={<XView x={null} />}><X /></LoadingSuspense>
      <LoadingFallback label="Loading tags" status={false}><Tags /></LoadingFallback>
    </>
  );
}
`,
    },
  },
  {
    rule: 'WHOLE_VIEW_SKELETON',
    fail: {
      'components/views.tsx':
        'export function SettingsFormSkeleton() { return <i />; }\nexport const DeviceLayoutSkeleton = () => <i />;\n',
    },
    pass: {
      'components/views.tsx':
        'export function BadgeSkeleton() { return <i />; }\n/** @deprecated Render the form in a scope. */\nexport function OldFormSkeleton() { return <Form loading />; }\n',
    },
  },
  {
    rule: 'FOLD_PROP',
    fail: { 'components/fold.tsx': 'export function W() { return <Table fold={3} />; }\n' },
    pass: { 'components/fold.tsx': 'export function W() { return <Table skeletonCount={TABLE_PAGE_SIZE} />; }\n' },
  },
  {
    rule: 'DEPRECATED_SKELETON',
    fail: {
      'components/old/old.tsx':
        '/**\n * @deprecated Render the thing in a scope.\n */\nexport function OldThingSkeleton() { return <OldThing loading />; }\nexport function OldThing() { return <b />; }\n',
      'components/use/use.tsx':
        "import { OldThingSkeleton } from '../old/old';\nexport function U() { return <OldThingSkeleton />; }\n",
    },
    pass: {
      'components/old/old.tsx':
        '/**\n * @deprecated Render the thing in a scope.\n */\nexport function OldThingSkeleton() { return <OldThing loading />; }\nexport function OldThing() { return <b />; }\n',
      'components/use/use.tsx':
        "import { OldThing } from '../old/old';\nexport function U() { return <OldThing />; }\n",
    },
  },
  {
    rule: 'RETIRED_API',
    fail: {
      'components/retired.tsx': 'export function R() { return <StreamedPage skeleton={<i />} read={read} />; }\n',
    },
    pass: {
      'components/retired.tsx': 'export function R() { return <StreamedPage placeholder={EMPTY} read={read} />; }\n',
    },
  },
  {
    rule: 'TYPED_COUNT',
    fail: {
      'components/typed.tsx': switching(`  return (
    <ul>
      {isLoading && <LoadingItems count={5}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>}
      <Table skeletonRows={rows.length ?? 8} />
    </ul>
  );`),
    },
    pass: {
      'components/typed.tsx': `const ROWS_SKELETON_COUNT = 5;\nconst DEFAULT_COLUMNS = 3;\nconst CARD_SKELETON_COUNT = DEFAULT_COLUMNS;\n${switching(`  return (
    <ul>
      {isLoading && <LoadingItems count={ROWS_SKELETON_COUNT}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>}
      <Grid skeletonCount={CARD_SKELETON_COUNT} />
    </ul>
  );`)}`,
    },
  },
  {
    rule: 'COUNT_SOURCE',
    fail: {
      'components/source.tsx': `import { CARDS } from './cards';\n${component('  return <Table skeletonRows={CARDS} />;')}`,
    },
    pass: {
      'components/source.tsx': `import { CARDS_PAGE_SIZE } from './cards';
export function Thing({ skeletonRows }: { skeletonRows: number }) {
  return <><Table skeletonRows={CARDS_PAGE_SIZE} /><Table skeletonRows={skeletonRows} /></>;
}
`,
    },
  },
  {
    rule: 'COUNT_CAP',
    fail: {
      'components/cap.tsx': `const PAGE_SIZE = 20;\n${switching(`  const VISIBLE_PAGE_SIZE = PAGE_SIZE > 6 ? 6 : PAGE_SIZE;
  const n = Math.min(PAGE_SIZE, ROW_FOLD);
  return (
    <ul>
      {isLoading
        ? Array.from({ length: VISIBLE_PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item />)
        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}
    </ul>
  );`)}`,
    },
    pass: {
      'components/cap.tsx': `const PAGE_SIZE = 20;\n${switching(`  const last = Math.min(PAGE_SIZE, rows.length);
  const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, last));
  return (
    <ul>
      {isLoading
        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item />)
        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}
    </ul>
  );`)}`,
    },
  },
  {
    rule: 'HIDDEN_ITEMS',
    fail: {
      'components/hidden.tsx': `const PAGE_SIZE = 20;\n${switching(`  return (
    <ul className={isLoading ? 'max-md:[&>*:nth-child(n+4)]:hidden' : ''}>
      {isLoading
        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item className={i > 3 ? 'max-md:hidden' : ''} />)
        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}
    </ul>
  );`)}`,
    },
    pass: {
      'components/hidden.tsx': `const PAGE_SIZE = 20;\n${switching(`  return (
    <ul>
      {isLoading
        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item className="flex" />)
        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}
    </ul>
  );`)}`,
    },
  },
  {
    rule: 'ITEM_MARK',
    fail: {
      'components/marks.tsx': `const PAGE_SIZE = 20;\n${switching(`  return (
    <ul className={record ? 'listItems' : ''}>
      {isLoading
        ? [...Array(PAGE_SIZE)].map((_, i) => <li key={i} />)
        : rows.map((r: string) => <li key={r}>{r}</li>)}
      <LoadingItems count={PAGE_SIZE}>{(i: number) => <Row key={i} />}</LoadingItems>
    </ul>
  );`)}function Row() { return <li />; }\n`,
    },
    pass: {
      'components/row.tsx': 'export function Row(props: object) { return <li {...loadingItemProps(props)} />; }\n',
      'components/marks.tsx': `import { Row } from './row';\nconst PAGE_SIZE = 20;\n${switching(`  return (
    <ul>
      {isLoading
        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item />)
        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}
      <LoadingItems count={PAGE_SIZE}>{(i: number) => <Row key={i} />}</LoadingItems>
      <LoadingItems count={record.columns}>{(i: number) => <span key={i} />}</LoadingItems>
    </ul>
  );`)}`,
    },
  },
  {
    rule: 'OPTIONAL_MARK',
    fail: {
      'components/optional.tsx': switching(`  return (
    <section>
      {isLoading ? <TextLineSkeleton type="h3" /> : <h3>{record.title}</h3>}
      {record.note && <p>{record.note}</p>}
      {record?.extra ? <p>{record.extra}</p> : null}
      {!isLoading && (
        <Banner />
      )}
    </section>
  );`),
    },
    pass: {
      'components/optional.tsx': switching(`  return (
    <section>
      {record.note && <p data-loading-optional>{record.note}</p>}
      {record.showHeader && <Header />}
      {!isLoading && rows.length === 0 && <EmptyState />}
      {isLoading && <TextLineSkeleton type="h3" />}
      {!isLoading && record.prepaid && <Total />}
      {!isLoading && !record.prepaid && <Estimate />}
      {record.error ? <LoadError /> : null}
      {noCustomers && <Notice />}
      {actions.copy && <CopyButton />}
      {anchorProps?.href ? <ExternalIcon /> : null}
      {isLoading ? <MediaSkeleton.Icon /> : record.os && <OsIcon os={record.os} />}
      <HoverCardContent>{record.breakdown && <Row />}</HoverCardContent>
      {!isLoading && <span role="status" className="sr-only">Loaded</span>}
    </section>
  );`),
      'components/split.tsx': `export function Card({ loading, item }: any) {
  if (useLoadingScope() || loading) return <CardSkeleton />;
  return <article>{item.subtitle && <p>{item.subtitle}</p>}</article>;
}
export function Page({ data }: any) {
  const scoped = useLoadingScope();
  let body;
  if (!data || scoped) body = <LoadingItems count={PAGE_SKELETON_ROWS}>{() => <Row data-loading-item />}</LoadingItems>;
  else body = <div>{data.install && <ScanCard />}</div>;
  return body;
}
export function Banner({ announcement }: any) {
  const inScope = useLoadingScope();
  if (inScope) return <i />;
  return <p>{announcement.description && <span>{announcement.description}</span>}</p>;
}
export function Header({ ticket }: any) {
  const inScope = useLoadingScope();
  return <h2 aria-busy={inScope}>{ticket.meta && <span>{ticket.meta}</span>}</h2>;
}
`,
    },
  },
  {
    rule: 'OPT_OUT',
    fail: {
      'components/opt.tsx': `export function A() {
  // loading-standard-ok: no rule named
  return <b />;
}
export function B() {
  // loading-standard-ok(SPINNER): lifts nothing on the next line
  return <b />;
}
`,
    },
    pass: {
      'components/opt.tsx': `export function A() {
  // loading-standard-ok(SPINNER): an upload's own progress mark
  return <div className="animate-spin" />;
}
`,
    },
  },
  {
    rule: 'PAGE_CODE',
    fail: {
      'app/thing/page.tsx':
        "import { TextLineSkeleton as Bar } from 'x';\nexport default function Page() { return <><Bar /><ThingSkeleton /></>; }\n",
    },
    pass: {
      'app/thing/page.tsx':
        "import dynamic from 'next/dynamic';\nconst Thing = dynamic(() => import('x'), { loading: () => <ThingSkeleton /> });\nexport default function Page() { return <LoadingSuspense><Thing /></LoadingSuspense>; }\n",
    },
  },
  {
    rule: 'RETIRED_API',
    name: 'a Hold* stand-in component',
    fail: {
      'components/retired.tsx': 'export function R() { return <HoldText text="x" />; }\n',
    },
    pass: {
      'components/retired.tsx': 'export function R() { return <TextHold text="x" />; }\n',
    },
  },
  {
    rule: 'TYPED_COUNT',
    name: 'a literal default on a prop that reaches a skeleton count',
    fail: {
      'components/list.tsx': `export function List({ size = 6, loading }: any) {
  const isLoading = useLoadingScope() || loading;
  return isLoading ? <LoadingItems count={size}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems> : <ul />;
}
`,
    },
    pass: {
      'components/list.tsx': `const LIST_PAGE_SIZE = 6;
export function List({ size = LIST_PAGE_SIZE, gap = 2, loading }: any) {
  const isLoading = useLoadingScope() || loading;
  return isLoading ? <LoadingItems count={size}>{(i: number) => <li key={i} data-loading-item className={\`gap-\${gap}\`} />}</LoadingItems> : <ul />;
}
`,
    },
  },
  {
    rule: 'TYPED_COUNT',
    name: 'a field of a local object holding a literal',
    fail: {
      'components/settings.tsx': switching(`  const settings = { rows: 4 };
  return isLoading ? <LoadingItems count={settings.rows}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems> : <ul />;`),
    },
    pass: {
      'components/settings.tsx': `const ROWS_PAGE_SIZE = 4;\n${switching(`  const settings = { rows: ROWS_PAGE_SIZE };
  return isLoading ? <LoadingItems count={settings.rows}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems> : <ul />;`)}`,
    },
  },
  {
    rule: 'TYPED_COUNT',
    name: 'a module constant holding a literal list, mapped while loading',
    fail: {
      'components/items.tsx': `const ITEMS = [1, 2, 3, 4];\n${switching(`  return isLoading ? <ul>{ITEMS.map(i => <li key={i} data-loading-item />)}</ul> : <ul />;`)}`,
    },
    pass: {
      'components/items.tsx': `const ITEMS_PAGE_SIZE = 4;\nconst WIDTHS = [60, 80, 40];\n${switching(`  return isLoading ? (
    <ul>
      {Array.from({ length: ITEMS_PAGE_SIZE }, (_, i) => <li key={i} data-loading-item style={{ width: WIDTHS[i % 3] }} />)}
    </ul>
  ) : <ul />;`)}`,
    },
  },
  {
    rule: 'COUNT_SOURCE',
    name: 'a count computed by a call, from the read, or with typed rows added',
    fail: {
      'components/computed.tsx': `export function Thing({ loading, rows, w }: any) {
  const isLoading = useLoadingScope() || loading;
  const { data } = useThings();
  return isLoading ? (
    <>
      <LoadingItems count={rowsFor(w)}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>
      <LoadingItems count={rows.length + 2}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>
      <LoadingItems count={data?.total ?? 0}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>
    </>
  ) : <ul />;
}
`,
    },
    pass: {
      'components/computed.tsx': `const ROWS_PAGE_SIZE = 10;
export function Thing({ loading, rows }: any) {
  const isLoading = useLoadingScope() || loading;
  return isLoading ? (
    <>
      <LoadingItems count={ROWS_PAGE_SIZE}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>
      <LoadingItems count={rows - 1}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>
      <LoadingItems count={Math.min(ROWS_PAGE_SIZE, rows.length)}>{(i: number) => <li key={i} data-loading-item />}</LoadingItems>
      <CardSkeleton rows={[{ width: 'w-1/2' }]} count={rows !== undefined} />
    </>
  ) : <ul />;
}
`,
    },
  },
];
