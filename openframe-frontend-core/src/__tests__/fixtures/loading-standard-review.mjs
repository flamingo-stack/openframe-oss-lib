/**
 * The round-5 reviewers' fixtures (CU-17tkuw5z69a): each shape a line-based gate missed. Every file under
 * `components/parent/` must fail the loading-standard engine (`components/child/` is the switching child they use).
 */
export const REVIEW_FIXTURES = {
  'components/child/child.tsx':
    'export function Child({ loading }: { loading?: boolean }) {\n  const l = useLoadingScope() || loading;\n  if (l) return <ChildSkeleton />;\n  return <b />;\n}\nexport function ChildSkeleton() { return <i />; }\n',
  'components/parent/f0-sanity.tsx':
    "import { ChildSkeleton } from '../child/child';\nexport function P0({ isLoading }: { isLoading: boolean }) { return isLoading ? <ChildSkeleton /> : <Child />; }\nexport function P01() { return <Suspense><X /></Suspense>; }\n",
  'components/parent/f1-alias.tsx':
    "import { ChildSkeleton as Bars } from '../child/child';\nexport function P1({ isLoading }: { isLoading: boolean }) { return isLoading ? <Bars /> : <Child />; }\n",
  'components/parent/f10-wholeview.tsx':
    'export function SettingsFormSkeleton() { return <i />; }\nexport function DeviceLayoutSkeleton() { return <i />; }\nexport function W({ fold }: any) { return <Table fold={3} />; }\n',
  'components/parent/f11-word.tsx':
    "const PAGE_SIZE = 20;\nexport function N({ loading, rows, listItems }: any) {\n  const isLoading = useLoadingScope() || loading;\n  return (\n    <ul className={listItems ? 'a' : 'b'}>\n      {isLoading\n        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} />)\n        : rows.map((r: string) => <li key={r}>{r}</li>)}\n    </ul>\n  );\n}\n",
  'components/parent/f12-multiline-null.tsx':
    'export function Q({ isLoading }: { isLoading: boolean }) {\n  if (isLoading) {\n    return null;\n  }\n  return <b />;\n}\nexport function Q2({ data }: any) {\n  return data ? <b /> : null;\n}\nexport function Q3() {\n  const { data, isLoading } = useQuery();\n  if (!data?.items) return null;\n  return <b />;\n}\n',
  'components/parent/f13-cap.tsx':
    "const PAGE_SIZE = 20;\nexport function C({ loading, rows }: any) {\n  const isLoading = useLoadingScope() || loading;\n  const VISIBLE_PAGE_SIZE = PAGE_SIZE > 6 ? 6 : PAGE_SIZE;\n  return (\n    <ul>\n      {isLoading\n        ? Array.from({ length: VISIBLE_PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item />)\n        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}\n      {isLoading\n        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} data-loading-item className={i > 3 ? 'max-md:hidden' : ''} />)\n        : rows.map((r: string) => <li key={r} data-loading-item>{r}</li>)}\n      <LoadingItems count={PAGE_SIZE}>{(i: number) => <li key={i} />}</LoadingItems>\n    </ul>\n  );\n}\n",
  'components/parent/f2-var.tsx':
    "import { ChildSkeleton } from '../child/child';\nconst Placeholder = ChildSkeleton;\nexport function P2({ isLoading }: { isLoading: boolean }) { return isLoading ? <Placeholder /> : <Child />; }\n",
  'components/parent/f3-createel.tsx':
    "import { ChildSkeleton } from '../child/child';\nexport function P3({ isLoading }: { isLoading: boolean }) { return isLoading ? createElement(ChildSkeleton) : <Child />; }\n",
  'components/parent/f4-propswitch.tsx':
    'export function Own({ pending }: { pending: boolean }) {\n  if (pending) return <OwnSkeleton />;\n  return <b />;\n}\nexport function Own2(props: { loading: boolean }) {\n  if (props.loading) return <Own2Skeleton />;\n  return <b />;\n}\nfunction OwnSkeleton() { return <i />; }\nfunction Own2Skeleton() { return <i />; }\n',
  'components/parent/f5-propswitch-sibling.tsx':
    'export function A() { const l = useLoadingScope(); return l ? <i /> : <b />; }\nexport function B({ loading }: { loading: boolean }) {\n  if (loading) return <BSkeleton />;\n  return <b />;\n}\nfunction BSkeleton() { return <i />; }\n',
  'components/parent/f6-spinner.tsx':
    'export function S1({ isLoading }: { isLoading: boolean }) {\n  return (\n    <div>\n      {isLoading && (\n        <Loader2 className="h-4 w-4 animate-spin" />\n      )}\n    </div>\n  );\n}\nexport function S2({ query }: { query: { isLoading: boolean } }) {\n  if (query.isLoading) return null;\n  if (isLoading || !data) return null;\n  return <div aria-label="Loading" className="animate-[pulse_2s_infinite]">{data ? <X /> : null}</div>;\n}\n',
  'components/parent/f7-suspense.tsx':
    'export function Su() {\n  return (\n    <>\n      <React.Suspense>\n        <X />\n      </React.Suspense>\n      <Suspense fallback={<></>}>\n        <X />\n      </Suspense>\n    </>\n  );\n}\n',
  'components/parent/f8-counts.tsx':
    'const PAGE_SIZE = 20;\nconst PAGE_SIZE_FOLD = 4;\nexport function L({ loading, rows }: { loading: boolean; rows: string[] }) {\n  const isLoading = useLoadingScope() || loading;\n  const shown = PAGE_SIZE > 6 ? 6 : PAGE_SIZE;\n  return (\n    <ul>\n      {isLoading && <LoadingItems count={5}>{i => <li key={i} />}</LoadingItems>}\n      {isLoading\n        ? Array.from({ length: PAGE_SIZE_FOLD }).map((_, i) => <li key={i} data-loading-item />)\n        : rows.map(r => <li key={r} data-loading-item>{r}</li>)}\n      {isLoading\n        ? Array.from({ length: shown }).map((_, i) => <li key={i} className="hidden md:block" data-loading-item />)\n        : rows.map(r => <li key={r}>{r}</li>)}\n      {isLoading ? [...Array(PAGE_SIZE)].map((_, i) => <li key={i} />) : rows.map(r => <li key={r}>{r}</li>)}\n    </ul>\n  );\n}\n',
  'components/parent/f9-marks.tsx':
    'const listItems = [];\nconst PAGE_SIZE = 20;\nexport function M({ loading, rows, record }: any) {\n  const isLoading = useLoadingScope() || loading;\n  return (\n    <ul>\n      {isLoading\n        ? Array.from({ length: PAGE_SIZE }).map((_, i) => <li key={i} />)\n        : rows.map((r: string) => <li key={r}>{r}</li>)}\n      {record.note && <p>{record.note}</p>}\n      {record?.extra ? <p>{record.extra}</p> : null}\n    </ul>\n  );\n}\n',
};
