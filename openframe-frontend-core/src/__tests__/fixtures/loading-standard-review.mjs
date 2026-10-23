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

/**
 * The round-6 reviewer's fixtures (CU-17tkuw5z69a): each hole the round-6 engine still had. Every file but the helpers
 * (`b20-comment-mark`, `b31-family`, `chart`) must fail; `c01-control` is the control the engine always caught.
 */
export const REVIEW_FIXTURES_R6 = {
  'components/r6/b01-false.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Widget() {\n  const { data, isLoading } = useQuery({ queryKey: ['w'] });\n  if (isLoading) return false;\n  return <div>{data.name}</div>;\n}\n",
  'components/r6/b02-or.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Widget2() {\n  const { data, isLoading } = useQuery({ queryKey: ['w'] });\n  return <section>{isLoading || <div>{data.name}</div>}</section>;\n}\n",
  'components/r6/b03-domain-data.tsx':
    "import { useTickets } from './hooks';\nexport function TicketList() {\n  const { tickets } = useTickets();\n  if (!tickets) return null;\n  return <ul>{tickets.map(t => <li key={t.id}>{t.title}</li>)}</ul>;\n}\n",
  'components/r6/b04-empty-div.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Widget4() {\n  const { data, isLoading } = useQuery({ queryKey: ['w'] });\n  if (isLoading) return <div />;\n  return <div>{data.name}</div>;\n}\n",
  'components/r6/b05-dynamic.tsx':
    "import dynamic from 'next/dynamic';\nconst Chart = dynamic(() => import('./chart'), { ssr: false });\nexport function Page5() { return <main><Chart /></main>; }\n",
  'components/r6/b06-ternary-js-fold.tsx':
    "import { Table } from '@flamingo-stack/openframe-frontend-core/components/ui';\nconst PAGE_SIZE = 20;\nexport function List6({ isMobile, rows }: { isMobile: boolean; rows: any[] }) {\n  return <Table data={rows} pagination={{ pageSize: PAGE_SIZE }} skeletonRows={isMobile ? 3 : 10} />;\n}\n",
  'components/r6/b07-min-lowercase.tsx':
    "import { LoadingItems } from '@flamingo-stack/openframe-frontend-core/components/ui';\nconst PAGE_SIZE = 20;\nconst rowsShown = 6;\nconst count = Math.min(PAGE_SIZE, rowsShown);\nexport function List7() {\n  return <ul><LoadingItems count={count}>{i => <li key={i} data-loading-item />}</LoadingItems></ul>;\n}\n",
  'components/r6/b08-skeleton-const-paged.tsx':
    "import { LoadingItems, useLoadingScope } from '@flamingo-stack/openframe-frontend-core/components/ui';\nimport { useQuery } from '@tanstack/react-query';\nconst PAGE_SIZE = 20;\nconst ROWS_SKELETON_COUNT = 4;\nexport function List8({ loading }: { loading?: boolean }) {\n  const scoped = useLoadingScope() || loading;\n  const { data } = useQuery({ queryKey: ['x', PAGE_SIZE] });\n  if (scoped) return <ul><LoadingItems count={ROWS_SKELETON_COUNT}>{i => <li key={i} data-loading-item />}</LoadingItems></ul>;\n  return <ul>{data.items.map((x: any) => <li key={x.id} data-loading-item>{x.n}</li>)}</ul>;\n}\n",
  'components/r6/b09-lines-name.tsx':
    'import { useLoadingScope, UnifiedSkeleton } from \'@flamingo-stack/openframe-frontend-core/components/ui\';\nconst TABLE_LINES = 3;\nexport function List9({ items }: { items: any[] }) {\n  const loading = useLoadingScope();\n  if (loading) return <ul>{Array.from({ length: TABLE_LINES }).map((_, i) => <li key={i}><UnifiedSkeleton className="h-4" /></li>)}</ul>;\n  return <ul>{items.map(x => <li key={x.id}>{x.n}</li>)}</ul>;\n}\n',
  'components/r6/b10-skeletoncount-passthrough.tsx':
    'import { useLoadingScope, UnifiedSkeleton } from \'@flamingo-stack/openframe-frontend-core/components/ui\';\nexport function Cards10({ items, skeletonCount }: { items: any[]; skeletonCount: number }) {\n  const loading = useLoadingScope();\n  if (loading) return <div>{Array.from({ length: skeletonCount }).map((_, i) => <div key={i}><UnifiedSkeleton className="h-20" /></div>)}</div>;\n  return <div>{items.map(x => <div key={x.id}>{x.n}</div>)}</div>;\n}\n',
  'components/r6/b11-loaded-unmarked.tsx':
    'import { LoadingItems, useLoadingScope, UnifiedSkeleton } from \'@flamingo-stack/openframe-frontend-core/components/ui\';\nconst PAGE_SIZE = 10;\nexport function List11({ items }: { items: any[] }) {\n  const loading = useLoadingScope();\n  if (loading) return <ul><LoadingItems count={PAGE_SIZE}>{i => <li key={i} data-loading-item><UnifiedSkeleton className="h-4" /></li>}</LoadingItems></ul>;\n  return <ul>{items.map(x => <li key={x.id}>{x.n}</li>)}</ul>;\n}\n',
  'components/r6/b12-own-placeholder.tsx':
    "import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';\nimport { useQuery } from '@tanstack/react-query';\nimport { Chart } from './chart';\nexport function Dash12() {\n  const { data, isLoading } = useQuery({ queryKey: ['d'] });\n  return <section>{isLoading ? <UnifiedSkeleton className=\"h-64 w-full\" /> : <Chart data={data} />}</section>;\n}\n",
  'components/r6/b13-text.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Text13() {\n  const { data, isFetching } = useQuery({ queryKey: ['t'] });\n  if (isFetching) return <p>Fetching devices\u2026</p>;\n  return <p>{data.n}</p>;\n}\nexport function Text13b({ busy }: { busy: boolean }) {\n  return <p>{busy ? 'loading\u2026' : 'Done'}</p>;\n}\nexport function Text13c() { return <p>Please wait\u2026</p>; }\n",
  'components/r6/b14-spin-variant.tsx':
    'export function Spin14() {\n  return <svg className="animate-[spin_1s_linear_infinite] h-6 w-6" />;\n}\nexport function Spin14b() {\n  return <div style={{ animation: \'pulse 2s infinite\' }} className="h-4 bg-ods-border" />;\n}\n',
  'components/r6/b15-spin-busy.tsx':
    "import { Loader2 } from 'lucide-react';\nimport { useQuery } from '@tanstack/react-query';\nexport function Spin15() {\n  const q = useQuery({ queryKey: ['s'] });\n  const busy = q.isLoading;\n  return <div>{busy ? <Loader2 className=\"animate-spin\" /> : <span>{String(q.data)}</span>}</div>;\n}\n",
  'components/r6/b16-wholeview-name.tsx':
    'import { UnifiedSkeleton } from \'@flamingo-stack/openframe-frontend-core/components/ui\';\nexport function DevicesDashboardSkeleton() { return <div><UnifiedSkeleton className="h-96" /></div>; }\nexport function SettingsPanelLoading() { return <div><UnifiedSkeleton className="h-96" /></div>; }\n',
  'components/r6/b17-usage.tsx':
    "import { useQuery } from '@tanstack/react-query';\nimport { DevicesDashboardSkeleton, SettingsPanelLoading } from './b16-wholeview-name';\nexport function Screen17() {\n  const { data, isLoading } = useQuery({ queryKey: ['d'] });\n  if (isLoading) return <SettingsPanelLoading />;\n  return <div>{data.x}<DevicesDashboardSkeleton /></div>;\n}\n",
  'components/r6/b18-hook-only-switch.tsx':
    "import { UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';\nimport { useQuery } from '@tanstack/react-query';\nexport function Card18() {\n  const { data, isLoading } = useQuery({ queryKey: ['c'] });\n  if (isLoading) return <UnifiedSkeleton className=\"h-10\" />;\n  return <div>{data.name}</div>;\n}\n",
  'components/r6/b19-suspense-blank.tsx':
    "import { Suspense } from 'react';\nimport { Chart } from './chart';\nexport function Page19() { return <Suspense fallback={<div className=\"h-64\" />}><Chart data={{}} /></Suspense>; }\n",
  'components/r6/b20-comment-mark.tsx':
    '// Row: no data-loading-item here (it is drawn elsewhere)\nexport function Row20({ v }: { v?: string }) { return <li>{v}</li>; }\n',
  'components/r6/b21-uses-row.tsx':
    "import { LoadingItems } from '@flamingo-stack/openframe-frontend-core/components/ui';\nimport { Row20 } from './b20-comment-mark';\nconst PAGE_SIZE = 10;\nexport function List21() { return <ul><LoadingItems count={PAGE_SIZE}>{i => <Row20 key={i} />}</LoadingItems></ul>; }\n",
  'components/r6/b22-optout.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Widget22() {\n  const { data, isLoading } = useQuery({ queryKey: ['w'] });\n  // loading-standard-ok: x\n  if (isLoading) return null;\n  return <div>{data.name}</div>;\n}\n",
  'components/r6/b23-hidden-class-var.tsx':
    "import { LoadingItems, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';\nconst PAGE_SIZE = 10;\nconst MOBILE_HIDE = 'max-md:hidden';\nexport function List23() {\n  return <ul><LoadingItems count={PAGE_SIZE}>{i => <li key={i} data-loading-item className={i > 3 ? MOBILE_HIDE : ''}><UnifiedSkeleton /></li>}</LoadingItems></ul>;\n}\n",
  'components/r6/b24-slice.tsx':
    "import { LoadingItems, UnifiedSkeleton } from '@flamingo-stack/openframe-frontend-core/components/ui';\nconst PAGE_SIZE = 10;\nexport function List24() {\n  return <ul><LoadingItems count={PAGE_SIZE}>{i => (i < 4 ? <li key={i} data-loading-item><UnifiedSkeleton /></li> : null)}</LoadingItems></ul>;\n}\n",
  'components/r6/b25-and-null-data.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Widget25() {\n  const query = useQuery({ queryKey: ['w'] });\n  const user = query.data;\n  if (!user) return null;\n  return <div>{user.name}</div>;\n}\n",
  'components/r6/b26-relay.tsx':
    "import { useLazyLoadQuery } from 'react-relay';\nimport { Suspense } from 'react';\nfunction Inner() { const d = useLazyLoadQuery<any>({} as any, {}); return <div>{d.x}</div>; }\nexport function Outer26() { return <Suspense fallback={<p>Loading</p>}><Inner /></Suspense>; }\n",
  'components/r6/b27-loadingsuspense-null.tsx':
    "import { LoadingSuspense } from '@flamingo-stack/openframe-frontend-core/components';\nimport { Chart } from './chart';\nexport function Page27() { return <LoadingSuspense label=\"Loading chart\" fallback={null}><Chart data={{}} /></LoadingSuspense>; }\n",
  'components/r6/b28-region-when.tsx':
    "import { LoadingRegion } from '@flamingo-stack/openframe-frontend-core/components';\nimport { LoadingWhen } from '@flamingo-stack/openframe-frontend-core/components/ui';\nimport { useQuery } from '@tanstack/react-query';\nimport { Chart } from './chart';\nexport function Tab28() {\n  const { data, isPending } = useQuery({ queryKey: ['p'] });\n  if (isPending) return <LoadingRegion label=\"Loading\"><LoadingWhen loading><Chart data={null} /></LoadingWhen></LoadingRegion>;\n  return <Chart data={data} />;\n}\n",
  'components/r6/b29-config-count.tsx':
    "import { NavigationSidebar } from '@flamingo-stack/openframe-frontend-core/components/navigation';\nexport function Shell29({ loading }: { loading: boolean }) {\n  const config = { items: [], loading, loadingRows: { primary: 7, secondary: 2 }, skeletonRows: 5 };\n  return <NavigationSidebar config={config} />;\n}\n",
  'components/r6/b30-window.tsx':
    "import { useQuery } from '@tanstack/react-query';\nexport function Widget30() {\n  const { data, isLoading } = useQuery({ queryKey: ['w'] });\n  // loading-standard-ok: an unrelated note about the next lines\n  const cls = 'h-4';\n  if (isLoading) return <div className=\"animate-pulse h-4\" />;\n  return <div className={cls}>{data.name}</div>;\n}\n",
  'components/r6/b31-family.tsx':
    'import { UnifiedSkeleton } from \'@flamingo-stack/openframe-frontend-core/components/ui\';\nexport function WidgetCard({ v }: { v: string }) { return <div>{v}</div>; }\nexport function WidgetCardSkeleton() { return <UnifiedSkeleton className="h-10" />; }\n',
  'components/r6/b32-family-parent.tsx':
    "import { WidgetCard, WidgetCardSkeleton } from './b31-family';\nexport function WidgetColumn({ isLoading, items }: { isLoading: boolean; items: string[] }) {\n  return <div>{isLoading ? <WidgetCardSkeleton /> : items.map(v => <WidgetCard key={v} v={v} />)}</div>;\n}\n",
  'components/r6/c01-control.tsx':
    'import { useQuery } from \'@tanstack/react-query\';\nexport function Control1() {\n  const { data, isLoading } = useQuery({ queryKey: [\'w\'] });\n  if (isLoading) return null;\n  return <div>{data.name}</div>;\n}\nexport function Control2() { return <div className="animate-pulse h-4" />; }\nexport function Control3() { return <span className="animate-spin" />; }\n',
  'components/r6/chart.tsx': 'export function Chart({ data }: { data: any }) { return <div>{data.x}</div>; }\n',
};
