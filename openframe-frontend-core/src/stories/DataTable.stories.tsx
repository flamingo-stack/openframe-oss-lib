/**
 * DataTable — detailed Storybook showcase.
 *
 * The new DataTable is a headless wrapper over TanStack Table (`@tanstack/react-table`)
 * with the card-row UI from the legacy `Table`. Every piece of state (sorting, filters,
 * row selection, column visibility) lives inside TanStack — we just render. See the
 * individual stories below for how each feature lights up.
 */

import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  DataTable,
  multiSelectFilterFn,
  useDataTable,
  type ColumnDef,
  type ColumnFiltersState,
  type RowSelectionState,
  type SortingState,
} from '../components/ui/data-table'
import { Button } from '../components/ui/button'
import { Checkbox } from '../components/ui/checkbox'
import { Tag } from '../components/ui/tag'
import { MoreActionsMenu } from '../components/ui/more-actions-menu'
import { Chevron02RightIcon } from '../components/icons-v2-generated'

/* ──────────────────────────────── sample data ───────────────────────────────── */

type DeviceStatus = 'online' | 'offline' | 'pending'
type DeviceOS = 'macOS' | 'Windows' | 'Linux'

interface Device {
  id: string
  hostname: string
  ipAddress: string
  os: DeviceOS
  status: DeviceStatus
  owner: { name: string; email: string }
  tags: string[]
  cpuLoad: number
  memoryGB: number
  lastSeen: string
}

const OWNERS = [
  { name: 'Ada Lovelace', email: 'ada@example.com' },
  { name: 'Alan Turing', email: 'alan@example.com' },
  { name: 'Grace Hopper', email: 'grace@example.com' },
  { name: 'Linus Torvalds', email: 'linus@example.com' },
  { name: 'Margaret Hamilton', email: 'margaret@example.com' },
]

const TAG_POOL = ['production', 'staging', 'dev', 'dmz', 'pci', 'edge', 'core', 'gpu', 'critical']

function pick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]!
}

function randTags(seed: number): string[] {
  const n = (seed % 3) + 1
  const result: string[] = []
  for (let i = 0; i < n; i++) {
    const tag = TAG_POOL[(seed + i * 3) % TAG_POOL.length]!
    if (!result.includes(tag)) result.push(tag)
  }
  return result
}

function makeDevices(count: number, startId = 1): Device[] {
  const statuses: DeviceStatus[] = ['online', 'offline', 'pending']
  const oss: DeviceOS[] = ['macOS', 'Windows', 'Linux']
  return Array.from({ length: count }, (_, i) => {
    const seed = startId + i
    return {
      id: String(seed),
      hostname: `host-${String(seed).padStart(4, '0')}`,
      ipAddress: `10.0.${Math.floor(seed / 256) % 256}.${seed % 256}`,
      os: pick(oss, seed),
      status: pick(statuses, seed * 7),
      owner: pick(OWNERS, seed * 3),
      tags: randTags(seed),
      cpuLoad: (seed * 13) % 100,
      memoryGB: [4, 8, 16, 32, 64][seed % 5]!,
      lastSeen: new Date(Date.now() - seed * 1000 * 60 * 17).toISOString(),
    }
  })
}

const DEVICES = makeDevices(24)
const DEVICES_6 = DEVICES.slice(0, 6)
const DEVICES_8 = DEVICES.slice(0, 8)
const DEVICES_10 = DEVICES.slice(0, 10)
const DEVICES_12 = DEVICES.slice(0, 12)
const DEVICES_30 = makeDevices(30)
const DEVICES_50 = makeDevices(50)

/* ─────────────────────────── shared cell renderers ──────────────────────────── */

function StatusTag({ status }: { status: DeviceStatus }) {
  const variant =
    status === 'online' ? 'success' : status === 'offline' ? 'error' : 'warning'
  return <Tag label={status} variant={variant} />
}

function OSBadge({ os }: { os: DeviceOS }) {
  return (
    <span className="text-h5 text-ods-text-primary">{os}</span>
  )
}

function OwnerCell({ owner }: { owner: Device['owner'] }) {
  const initials = owner.name
    .split(' ')
    .map(s => s[0])
    .slice(0, 2)
    .join('')
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="w-8 h-8 rounded-full bg-ods-bg-active flex items-center justify-center shrink-0 text-h5 text-ods-text-secondary">
        {initials}
      </div>
      <div className="flex flex-col min-w-0">
        <span className="text-h4 text-ods-text-primary truncate">{owner.name}</span>
        <span className="text-h6 text-ods-text-secondary truncate">{owner.email}</span>
      </div>
    </div>
  )
}

function TagsCell({ tags }: { tags: string[] }) {
  return (
    <div className="flex flex-wrap gap-1">
      {tags.map(t => (
        <Tag key={t} label={t} variant="grey" />
      ))}
    </div>
  )
}

function LoadCell({ value, unit = '%' }: { value: number; unit?: string }) {
  const intent =
    value >= 85 ? 'text-ods-error' : value >= 60 ? 'text-ods-warning' : 'text-ods-text-primary'
  return <span className={`text-h4 ${intent}`}>{value}{unit}</span>
}

function LastSeenCell({ iso }: { iso: string }) {
  const d = new Date(iso)
  return (
    <div className="flex flex-col">
      <span className="text-h4 text-ods-text-primary">{d.toLocaleDateString()}</span>
      <span className="text-h6 text-ods-text-secondary">{d.toLocaleTimeString()}</span>
    </div>
  )
}

/* ───────────────────────── reusable column factories ────────────────────────── */

/**
 * Full list of columns used across stories. Individual stories can pick a subset
 * with `columns.filter(...)` or compose their own via `...columns, ...extras`.
 */
function baseColumns(): ColumnDef<Device>[] {
  return [
    {
      accessorKey: 'hostname',
      header: 'Hostname',
      meta: { width: 'w-[200px] shrink-0' },
    },
    {
      accessorKey: 'ipAddress',
      header: 'IP',
      meta: { width: 'w-[140px] shrink-0', hideAt: ['md'] },
    },
    {
      accessorKey: 'os',
      header: 'OS',
      filterFn: multiSelectFilterFn,
      cell: ({ row }) => <OSBadge os={row.original.os} />,
      meta: {
        width: 'w-[120px] shrink-0',
        filter: {
          options: [
            { id: 'macOS', label: 'macOS', value: 'macOS' },
            { id: 'Windows', label: 'Windows', value: 'Windows' },
            { id: 'Linux', label: 'Linux', value: 'Linux' },
          ],
        },
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      filterFn: multiSelectFilterFn,
      cell: ({ row }) => <StatusTag status={row.original.status} />,
      meta: {
        width: 'w-[140px] shrink-0',
        filter: {
          options: [
            { id: 'online', label: 'Online', value: 'online' },
            { id: 'offline', label: 'Offline', value: 'offline' },
            { id: 'pending', label: 'Pending', value: 'pending' },
          ],
        },
      },
    },
    {
      id: 'owner',
      accessorFn: row => row.owner.name,
      header: 'Owner',
      cell: ({ row }) => <OwnerCell owner={row.original.owner} />,
      meta: { width: 'flex-1 min-w-[200px]', hideAt: ['md'] },
    },
    {
      accessorKey: 'tags',
      header: 'Tags',
      enableSorting: false,
      cell: ({ row }) => <TagsCell tags={row.original.tags} />,
      meta: { width: 'w-[220px] shrink-0', hideAt: ['md', 'lg'] },
    },
    {
      accessorKey: 'cpuLoad',
      header: 'CPU',
      cell: ({ row }) => <LoadCell value={row.original.cpuLoad} />,
      meta: { width: 'w-[80px] shrink-0', align: 'right', hideAt: ['md', 'lg'] },
    },
    {
      accessorKey: 'memoryGB',
      header: 'Memory',
      cell: ({ row }) => <LoadCell value={row.original.memoryGB} unit="GB" />,
      meta: { width: 'w-[100px] shrink-0', align: 'right', hideAt: ['md', 'lg', 'xl'] },
    },
    {
      accessorKey: 'lastSeen',
      header: 'Last seen',
      cell: ({ row }) => <LastSeenCell iso={row.original.lastSeen} />,
      meta: { width: 'w-[160px] shrink-0', hideAt: ['md', 'lg', 'xl'] },
    },
  ]
}

/* ───────────────────────────────── meta ─────────────────────────────────────── */

const meta = {
  title: 'UI/DataTable',
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: [
          '`DataTable` is a compound component built on TanStack Table. The root',
          'takes a `table` instance from `useDataTable(...)`. All state (sort,',
          'filters, selection, visibility) lives inside TanStack — your consumer',
          'code stays declarative.',
          '',
          'Row actions, chevron links, and selection checkboxes are **regular',
          'columns** — declared inline in your `columns: ColumnDef<T>[]` array,',
          'not via magic props.',
          '',
          'The single primitive interactive cells must opt into is the',
          '`data-no-row-click` attribute on a wrapper div — without it, clicks',
          'inside the cell would bubble to `onRowClick` / row navigation.',
        ].join('\n'),
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

/* ─────────────────────────────────── stories ──────────────────────────────────── */

/**
 * **Basic** — the smallest useful setup: data + columns. Nothing else.
 *
 * `useDataTable` defaults to `manualSorting: true` / `manualFiltering: true`
 * (assuming server-side). For pure client-side tables pass
 * `clientSideSorting: true` and/or `clientSideFiltering: true`.
 */
export const Basic: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[260px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[160px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_6, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body emptyMessage="No devices" />
      </DataTable>
    )
  },
}

/**
 * **Client-side sorting** — set `clientSideSorting: true`, mark columns with
 * `enableSorting: true` (default) and TanStack handles the rest. Click a header
 * to sort; shift-click to multi-sort.
 */
export const WithSorting: Story = {
  render: () => {
    const [sorting, setSorting] = useState<SortingState>([
      { id: 'hostname', desc: false },
    ])

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[200px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        {
          accessorKey: 'cpuLoad',
          header: 'CPU',
          cell: ({ row }) => <LoadCell value={row.original.cpuLoad} />,
          meta: { width: 'w-[120px]', align: 'right' },
        },
        {
          accessorKey: 'memoryGB',
          header: 'Memory',
          cell: ({ row }) => <LoadCell value={row.original.memoryGB} unit="GB" />,
          meta: { width: 'w-[120px]', align: 'right' },
        },
      ],
      [],
    )

    const table = useDataTable<Device>({
      data: DEVICES_10,
      columns,
      clientSideSorting: true,
      state: { sorting },
      onSortingChange: setSorting,
    })

    return (
      <div className="space-y-4">
        <div className="text-h5 text-ods-text-secondary">
          Current sort: <code>{JSON.stringify(sorting)}</code>
        </div>
        <DataTable table={table}>
          <DataTable.Header />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Client-side filtering** — columns declare `meta.filter.options` and the
 * header automatically renders a checkbox dropdown. `multiSelectFilterFn` wires
 * the selection to `filterFn` so filtered rows update live.
 *
 * For server-side (Relay/REST), drop `clientSideFiltering: true` and translate
 * `columnFilters` state into backend query variables in a `useEffect`.
 */
export const WithFilters: Story = {
  render: () => {
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[200px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'os',
          header: 'OS',
          filterFn: multiSelectFilterFn,
          meta: {
            width: 'w-[140px]',
            filter: {
              options: [
                { id: 'macOS', label: 'macOS', value: 'macOS' },
                { id: 'Windows', label: 'Windows', value: 'Windows' },
                { id: 'Linux', label: 'Linux', value: 'Linux' },
              ],
            },
          },
        },
        {
          accessorKey: 'status',
          header: 'Status',
          filterFn: multiSelectFilterFn,
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: {
            width: 'w-[160px]',
            filter: {
              options: [
                { id: 'online', label: 'Online', value: 'online' },
                { id: 'offline', label: 'Offline', value: 'offline' },
                { id: 'pending', label: 'Pending', value: 'pending' },
              ],
            },
          },
        },
      ],
      [],
    )

    const table = useDataTable<Device>({
      data: DEVICES,
      columns,
      clientSideFiltering: true,
      state: { columnFilters },
      onColumnFiltersChange: setColumnFilters,
    })

    return (
      <div className="space-y-4">
        <div className="text-h5 text-ods-text-secondary">
          Active filters: <code>{JSON.stringify(columnFilters)}</code>
        </div>
        <DataTable table={table}>
          <DataTable.Header />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Row selection** — add a checkbox column wired to TanStack's selection API
 * (`table.getIsAllRowsSelected`, `row.toggleSelected`, etc.) and turn on
 * `enableRowSelection`. Access selected rows via `table.getSelectedRowModel()`
 * and render a toolbar above the table (as below).
 *
 * The checkbox cell is wrapped in `data-no-row-click` so clicking it does not
 * trigger `onRowClick`.
 */
export const WithRowSelection: Story = {
  render: () => {
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        {
          id: 'select',
          header: ({ table }) => (
            <div data-no-row-click>
              <Checkbox
                checked={
                  table.getIsAllRowsSelected()
                    ? true
                    : table.getIsSomeRowsSelected()
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={v => table.toggleAllRowsSelected(Boolean(v))}
                className="border-ods-border"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div data-no-row-click className="pointer-events-auto">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={v => row.toggleSelected(Boolean(v))}
                className="border-ods-border"
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
          meta: { width: 'w-10 shrink-0 flex-none', align: 'center' },
        },
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[220px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({
      data: DEVICES_8,
      columns,
      enableRowSelection: true,
      // Don't allow picking offline devices — just to show the capability.
      // enableRowSelection: row => row.original.status !== 'offline',
      getRowId: row => row.id,
      state: { rowSelection },
      onRowSelectionChange: setRowSelection,
    })

    const selected = table.getSelectedRowModel().rows
    const selectedCount = selected.length

    return (
      <div className="space-y-2">
        {selectedCount > 0 && (
          <div className="flex items-center justify-between bg-ods-card border border-ods-border rounded-[6px] p-3">
            <span className="text-ods-text-secondary text-sm">
              {selectedCount} device{selectedCount !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => table.resetRowSelection()}>
                Clear
              </Button>
              <Button
                onClick={() => alert(`Would restart: ${selected.map(r => r.original.hostname).join(', ')}`)}
              >
                Restart selected
              </Button>
            </div>
          </div>
        )}

        <DataTable table={table}>
          <DataTable.Header />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Actions column** — just a regular column. Wrap interactive content in a
 * `data-no-row-click` div so clicks inside don't bubble to `onRowClick`.
 * `pointer-events-auto` is required when the parent row is in link mode
 * (so it doesn't disable mouse events for the actions).
 */
export const WithActionsColumn: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[220px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
        {
          id: 'actions',
          cell: ({ row }) => {
            const device = row.original
            return (
              <div
                data-no-row-click
                className="flex gap-2 items-center justify-end pointer-events-auto"
              >
                <MoreActionsMenu
                  items={[
                    { label: 'Ping', onClick: () => alert(`Ping ${device.hostname}`) },
                    { label: 'Restart', onClick: () => alert(`Restart ${device.hostname}`) },
                    { label: 'Remove', onClick: () => alert(`Remove ${device.hostname}`), danger: true },
                  ]}
                />
              </div>
            )
          },
          enableSorting: false,
          meta: { width: 'w-[60px] shrink-0 flex-none', align: 'right' },
        },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_8, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body onRowClick={d => console.log('Row clicked:', d.hostname)} />
      </DataTable>
    )
  },
}

/**
 * **Chevron link column** — pair `<DataTable.Body rowHref={...}>` (which
 * makes the whole card a link) with a per-row chevron button on the right.
 * The button uses the `Button` component with `href`, which renders as
 * `next/link` so middle-click / Cmd+click "open in new tab" works natively.
 *
 * `data-no-row-click` is technically unnecessary here (the row link is
 * absolute-positioned and the cell is `pointer-events: none` in link mode),
 * but it's defensive and consistent with action columns.
 */
export const WithChevronLink: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[220px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
        {
          id: 'open',
          cell: ({ row }) => (
            <div
              data-no-row-click
              className="flex items-center justify-end pointer-events-auto"
            >
              <Button
                href={`#/devices/${row.original.id}`}
                prefetch={false}
                variant="outline"
                size="icon"
                centerIcon={<Chevron02RightIcon className="w-5 h-5" />}
                aria-label="View details"
                className="bg-ods-card"
              />
            </div>
          ),
          enableSorting: false,
          meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
        },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_8, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body rowHref={d => `#/devices/${d.id}`} />
      </DataTable>
    )
  },
}

/**
 * **Row click** — pass `onRowClick` on `<DataTable.Body>` to handle whole-row
 * clicks. Combine with `data-no-row-click` on inner interactive elements
 * (any cell with interactive content should add this on its wrapper).
 */
export const WithRowClick: Story = {
  render: () => {
    const [selected, setSelected] = useState<Device | null>(null)

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[220px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_6, columns })

    return (
      <div className="space-y-4">
        <div className="text-h5 text-ods-text-secondary">
          Selected: {selected ? selected.hostname : '—'}
        </div>
        <DataTable table={table}>
          <DataTable.Header />
          <DataTable.Body onRowClick={setSelected} />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Loading state** — pass `loading` on `<DataTable.Body>`. While `loading`
 * is truthy and no rows are available yet, the card skeleton shows with
 * column-aware widths.
 */
export const Loading: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(() => baseColumns(), [])

    const table = useDataTable<Device>({ data: [], columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body loading skeletonRows={6} />
      </DataTable>
    )
  },
}

/**
 * **Empty state** — when there are no rows and `loading` is falsy, the body
 * renders the built-in empty state. Override the message via `emptyMessage`.
 */
export const EmptyState: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(() => baseColumns().slice(0, 4), [])
    const table = useDataTable<Device>({ data: [], columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body emptyMessage="No devices match your filters" />
      </DataTable>
    )
  },
}

/**
 * **Sticky header** — set `stickyHeader` on `<DataTable.Header>` and provide a
 * Tailwind `stickyHeaderOffset` matching your app's fixed top bar.
 *
 * Scroll inside the container below to see it.
 */
export const StickyHeader: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[220px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'w-[120px]' } },
        {
          accessorKey: 'cpuLoad',
          header: 'CPU',
          cell: ({ row }) => <LoadCell value={row.original.cpuLoad} />,
          meta: { width: 'flex-1 min-w-[100px]', align: 'right' },
        },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_30, columns })

    return (
      <div className="h-[600px] overflow-auto p-4">
        <div className="h-[80px] bg-ods-card border border-ods-border rounded-[6px] flex items-center justify-center mb-4">
          <span className="text-ods-text-secondary">Fake page header above</span>
        </div>
        <DataTable table={table}>
          <DataTable.Header stickyHeader stickyHeaderOffset="top-0" />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Responsive columns** — `meta.hideAt` accepts a Tailwind breakpoint or a
 * list, controlling when the column is hidden.
 *
 * - `hideAt: ['md']` — hidden below `md`, shown from `md` up
 * - `hideAt: ['md', 'lg']` — hidden through `lg`, shown from `xl` up
 *
 * Resize the Storybook viewport to see columns appear/disappear.
 */
export const ResponsiveColumns: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(() => baseColumns(), [])
    const table = useDataTable<Device>({ data: DEVICES_8, columns })

    return (
      <div className="space-y-2">
        <div className="text-h5 text-ods-text-secondary">
          IP hides below <code>md</code>, Tags/CPU hide below <code>lg</code>,
          Memory/Last seen hide below <code>xl</code>.
        </div>
        <DataTable table={table}>
          <DataTable.Header />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Infinite scroll** — place `<DataTable.InfiniteFooter>` after the body.
 * When the sentinel intersects, it calls `onLoadMore()`. Skeleton rows appear
 * underneath while `isFetchingNextPage` is true.
 *
 * In a real app, these props come from Relay's `usePaginationFragment`
 * (`hasNext`, `isLoadingNext`, `loadNext(50)`) or TanStack Query's
 * `useInfiniteQuery`.
 */
export const InfiniteScroll: Story = {
  render: () => {
    const [rows, setRows] = useState<Device[]>(() => makeDevices(20))
    const [isFetching, setIsFetching] = useState(false)
    const [hasNext, setHasNext] = useState(true)
    const pageRef = useRef(1)

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[200px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: rows, columns })

    const loadMore = useCallback(() => {
      if (isFetching || !hasNext) return
      setIsFetching(true)
      window.setTimeout(() => {
        pageRef.current += 1
        setRows(prev => [...prev, ...makeDevices(20, prev.length + 1)])
        setIsFetching(false)
        if (pageRef.current >= 4) setHasNext(false)
      }, 700)
    }, [isFetching, hasNext])

    return (
      <div className="space-y-2">
        <div className="text-h5 text-ods-text-secondary">
          Loaded {rows.length} rows · page {pageRef.current}
          {!hasNext && ' · end of list'}
        </div>
        <DataTable table={table}>
          <DataTable.Header stickyHeader stickyHeaderOffset="top-0" />
          <DataTable.Body />
          <DataTable.InfiniteFooter
            hasNextPage={hasNext}
            isFetchingNextPage={isFetching}
            onLoadMore={loadMore}
          />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Cursor pagination** — use `<DataTable.CursorFooter>` for a prev/next
 * footer with "Showing X of Y" summary. Pair with Relay's `usePaginationFragment`
 * (`loadNext` / `loadPrevious`) or any cursor-based REST endpoint.
 */
export const CursorPagination: Story = {
  render: () => {
    const PAGE_SIZE = 8
    const [page, setPage] = useState(1)
    const maxPage = Math.ceil(DEVICES_50.length / PAGE_SIZE)
    const rows = useMemo(
      () => DEVICES_50.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
      [page],
    )

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[200px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: rows, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body minRows={PAGE_SIZE} />
        <DataTable.CursorFooter
          hasNextPage={page < maxPage}
          hasPreviousPage={page > 1}
          isFirstPage={page === 1}
          totalCount={DEVICES_50.length}
          itemName="device"
          onNext={() => setPage(p => Math.min(p + 1, maxPage))}
          onPrevious={() => setPage(p => Math.max(p - 1, 1))}
          onReset={() => setPage(1)}
        />
      </DataTable>
    )
  },
}

/**
 * **Compact mode** — pass `compact` on `<DataTable.Body>` for a denser row
 * height (`py-2` instead of the standard 72–88px clamp). Good for dense data
 * lists like device selection or audit logs.
 */
export const CompactMode: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[200px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )
    const table = useDataTable<Device>({ data: DEVICES_12, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body compact />
      </DataTable>
    )
  },
}

/**
 * **Rich cells** — cells are just React nodes. Use whatever UI-kit primitives
 * fit: avatars, badges, tag lists, multi-line layouts.
 */
export const RichCells: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(() => baseColumns(), [])
    const table = useDataTable<Device>({ data: DEVICES_8, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable>
    )
  },
}

/**
 * **Column visibility** — every column has `column.getIsVisible()` /
 * `toggleVisibility()`. Pair with a simple checkbox list to let the user
 * show/hide columns at runtime.
 */
export const ColumnVisibility: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(() => baseColumns(), [])
    const table = useDataTable<Device>({ data: DEVICES_10, columns })

    const allColumns = table
      .getAllLeafColumns()
      .filter(c => !c.id.startsWith('__')) // hide synthetic columns from the picker

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 p-3 bg-ods-card border border-ods-border rounded-[6px]">
          <span className="text-h5 text-ods-text-secondary self-center">Columns:</span>
          {allColumns.map(col => (
            <label key={col.id} className="flex items-center gap-2 text-h5 text-ods-text-primary">
              <input
                type="checkbox"
                checked={col.getIsVisible()}
                onChange={e => col.toggleVisibility(e.target.checked)}
              />
              {typeof col.columnDef.header === 'string' ? col.columnDef.header : col.id}
            </label>
          ))}
        </div>
        <DataTable table={table}>
          <DataTable.Header />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Custom header label** — when you need something richer than a plain
 * string, pass a header render function. It receives the `HeaderContext` so
 * you can read sort state, call sorting handlers, etc.
 */
export const CustomHeader: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        {
          accessorKey: 'hostname',
          header: () => (
            <span className="text-h5 text-ods-accent uppercase whitespace-nowrap flex items-center gap-1">
              📡 Hostname
            </span>
          ),
          meta: { width: 'w-[240px]' },
        },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_6, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body />
      </DataTable>
    )
  },
}

/**
 * **Pre-fetch delay** — simulates the initial load. For ~700ms the body shows
 * skeleton rows, then the real data fades in.
 */
export const SimulatedInitialLoad: Story = {
  render: () => {
    const [loading, setLoading] = useState(true)
    const [rows, setRows] = useState<Device[]>([])

    useEffect(() => {
      const id = window.setTimeout(() => {
        setRows(DEVICES_10)
        setLoading(false)
      }, 900)
      return () => window.clearTimeout(id)
    }, [])

    const columns = useMemo<ColumnDef<Device>[]>(() => baseColumns(), [])
    const table = useDataTable<Device>({ data: rows, columns })

    return (
      <DataTable table={table}>
        <DataTable.Header />
        <DataTable.Body loading={loading} skeletonRows={10} />
      </DataTable>
    )
  },
}

/**
 * **Row count** — `<DataTable.RowCount itemName="device" />` reads the row
 * count from the table context and renders `"Showing N devices"`. Two common
 * placements:
 *
 * - **Inside the header's right slot** — same look as the legacy `Table`:
 *   `<DataTable.Header rightSlot={<DataTable.RowCount itemName="device" />} />`
 * - **Above the table in a toolbar** — when you want to pair it with action
 *   buttons or filter pills.
 *
 * Replaces the legacy behavior of auto-injecting "Showing N results" into the
 * actions column header — now it's explicit, opt-in, and you choose the spot.
 */
export const WithRowCount: Story = {
  render: () => {
    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[220px]' } },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'w-[140px]' } },
        {
          accessorKey: 'status',
          header: 'Status',
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: { width: 'w-[140px]' },
        },
        { accessorKey: 'os', header: 'OS', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({ data: DEVICES_8, columns })

    return (
      <div className="space-y-6">
        <div className="space-y-1">
          <h3 className="text-h5 text-ods-text-secondary">In header right slot</h3>
          <DataTable table={table}>
            <DataTable.Header rightSlot={<DataTable.RowCount itemName="device" />} />
            <DataTable.Body />
          </DataTable>
        </div>

        <div className="space-y-1">
          <h3 className="text-h5 text-ods-text-secondary">In a toolbar above the table</h3>
          <DataTable table={table}>
            <div className="flex items-center justify-between mb-1">
              <DataTable.RowCount itemName="device" />
              <Button variant="outline">Add device</Button>
            </div>
            <DataTable.Header />
            <DataTable.Body />
          </DataTable>
        </div>
      </div>
    )
  },
}

export const URLBackedFilters: Story = {
  render: () => {
    // Simulated URL state: `status` is a comma-separated list.
    const [urlParams, setUrlParams] = useState<Record<string, string>>({
      status: 'online',
    })

    // Irrelevant state that forces re-renders — mimics how URL-backed apps
    // re-run this component frequently (navigation, searchParams changes).
    const [tick, setTick] = useState(0)

    // Rebuild ColumnFiltersState from "URL" on every render — a NEW array ref
    // every time. This is the pattern that used to thrash; now it's safe.
    const columnFilters: ColumnFiltersState = Object.entries(urlParams)
      .filter(([, v]) => v)
      .map(([id, v]) => ({ id, value: v.split(',').filter(Boolean) }))

    const handleFiltersChange = useCallback(
      (updater: ColumnFiltersState | ((old: ColumnFiltersState) => ColumnFiltersState)) => {
        const next = typeof updater === 'function' ? updater(columnFilters) : updater
        const params: Record<string, string> = {}
        next.forEach(f => {
          params[f.id] = (f.value as string[]).join(',')
        })
        setUrlParams(params)
      },
      [columnFilters],
    )

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        { accessorKey: 'hostname', header: 'Hostname', meta: { width: 'w-[200px]' } },
        {
          accessorKey: 'os',
          header: 'OS',
          filterFn: multiSelectFilterFn,
          meta: {
            width: 'w-[140px]',
            filter: {
              options: [
                { id: 'macOS', label: 'macOS', value: 'macOS' },
                { id: 'Windows', label: 'Windows', value: 'Windows' },
                { id: 'Linux', label: 'Linux', value: 'Linux' },
              ],
            },
          },
        },
        {
          accessorKey: 'status',
          header: 'Status',
          filterFn: multiSelectFilterFn,
          cell: ({ row }) => <StatusTag status={row.original.status} />,
          meta: {
            width: 'w-[140px]',
            filter: {
              options: [
                { id: 'online', label: 'Online', value: 'online' },
                { id: 'offline', label: 'Offline', value: 'offline' },
                { id: 'pending', label: 'Pending', value: 'pending' },
              ],
            },
          },
        },
        { accessorKey: 'ipAddress', header: 'IP', meta: { width: 'flex-1 min-w-0' } },
      ],
      [],
    )

    const table = useDataTable<Device>({
      data: DEVICES,
      columns,
      clientSideFiltering: true,
      state: { columnFilters },
      onColumnFiltersChange: handleFiltersChange,
    })

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap gap-3 items-center p-3 bg-ods-card border border-ods-border rounded-[6px]">
          <div className="text-h5 text-ods-text-secondary">
            Simulated URL state:{' '}
            <code className="text-ods-text-primary">
              ?{new URLSearchParams(urlParams).toString() || '(empty)'}
            </code>
          </div>
          <Button variant="outline" onClick={() => setTick(t => t + 1)}>
            Force re-render ({tick})
          </Button>
        </div>
        <DataTable table={table}>
          <DataTable.Header rightSlot={<DataTable.RowCount itemName="device" />} />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}

/**
 * **Kitchen sink** — everything enabled at once: client-side sort, client-side
 * filters, row selection, actions column, chevron link, sticky header, custom
 * cells, responsive hides. Use this as a reference for wiring a real page.
 */
export const KitchenSink: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => {
    const [sorting, setSorting] = useState<SortingState>([])
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})

    const columns = useMemo<ColumnDef<Device>[]>(
      () => [
        // Selection checkbox column.
        {
          id: 'select',
          header: ({ table }) => (
            <div data-no-row-click>
              <Checkbox
                checked={
                  table.getIsAllRowsSelected()
                    ? true
                    : table.getIsSomeRowsSelected()
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={v => table.toggleAllRowsSelected(Boolean(v))}
                className="border-ods-border"
              />
            </div>
          ),
          cell: ({ row }) => (
            <div data-no-row-click className="pointer-events-auto">
              <Checkbox
                checked={row.getIsSelected()}
                onCheckedChange={v => row.toggleSelected(Boolean(v))}
                className="border-ods-border"
              />
            </div>
          ),
          enableSorting: false,
          enableHiding: false,
          meta: { width: 'w-10 shrink-0 flex-none', align: 'center' },
        },
        ...baseColumns(),
        // Per-row actions column.
        {
          id: 'actions',
          cell: ({ row }) => {
            const device = row.original
            return (
              <div
                data-no-row-click
                className="flex gap-2 items-center justify-end pointer-events-auto"
              >
                <MoreActionsMenu
                  items={[
                    { label: 'Ping', onClick: () => alert(`Ping ${device.hostname}`) },
                    { label: 'Restart', onClick: () => alert(`Restart ${device.hostname}`) },
                    { label: 'Remove', onClick: () => alert(`Remove ${device.hostname}`), danger: true },
                  ]}
                />
              </div>
            )
          },
          enableSorting: false,
          meta: { width: 'w-[60px] shrink-0 flex-none', align: 'right' },
        },
        // Chevron link column.
        {
          id: 'open',
          cell: ({ row }) => (
            <div
              data-no-row-click
              className="flex items-center justify-end pointer-events-auto"
            >
              <Button
                href={`#/devices/${row.original.id}`}
                prefetch={false}
                variant="outline"
                size="icon"
                centerIcon={<Chevron02RightIcon className="w-5 h-5" />}
                aria-label="View details"
                className="bg-ods-card"
              />
            </div>
          ),
          enableSorting: false,
          meta: { width: 'w-12 shrink-0 flex-none', align: 'right' },
        },
      ],
      [],
    )

    const table = useDataTable<Device>({
      data: DEVICES,
      columns,
      clientSideSorting: true,
      clientSideFiltering: true,
      enableRowSelection: true,
      getRowId: row => row.id,
      state: { sorting, columnFilters, rowSelection },
      onSortingChange: setSorting,
      onColumnFiltersChange: setColumnFilters,
      onRowSelectionChange: setRowSelection,
    })

    const selected = table.getSelectedRowModel().rows

    return (
      <div className="h-[700px] overflow-auto p-4 space-y-2">
        {selected.length > 0 && (
          <div className="sticky top-0 z-20 flex items-center justify-between bg-ods-card border border-ods-border rounded-[6px] p-3">
            <span className="text-ods-text-secondary text-sm">
              {selected.length} device{selected.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => table.resetRowSelection()}>
                Clear
              </Button>
              <Button
                onClick={() =>
                  alert(`Would restart: ${selected.map(r => r.original.hostname).join(', ')}`)
                }
              >
                Restart selected
              </Button>
            </div>
          </div>
        )}
        <DataTable table={table}>
          <DataTable.Header
            stickyHeader
            stickyHeaderOffset={selected.length > 0 ? 'top-[60px]' : 'top-0'}
            rightSlot={<DataTable.RowCount itemName="result" />}
          />
          <DataTable.Body />
        </DataTable>
      </div>
    )
  },
}
