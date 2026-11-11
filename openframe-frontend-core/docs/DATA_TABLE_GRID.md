# Moving a table to the grid layout

`<DataTable layout="grid">` draws one bordered table of 48px one-line rows, with pinned columns, column resize and
(with `settings`) a gear menu whose column layout is kept in the browser. It applies from the content `md` step up;
below it the same table draws its card rows, so a table's `cell` renderers stay.

The layout is opt-in. A table that does not ask for it renders its card rows exactly as before.

## Before a table switches

Go through its column definitions:

| What | Why |
|---|---|
| `size` on every data column (px) | The grid lays columns out by `column.getSize()`. Without it a column is TanStack's default 150px. The `meta.width` classes are for card rows only. |
| `minSize` where the cell holds more than text | A column cannot be resized below it. The default is 120 (text). Use `GRID_MIN_WIDTH.icon` (148) for an icon and text, `GRID_MIN_WIDTH.media` (160) for a picture or an avatar and text. |
| `meta.gridCell` | The cell's form in the grid: ONE line, normally a `DataTable.Cell` (leading icon / picture / avatar, text, tag, secondary text, trailing mark). `cell` stays the card form. A column without `gridCell` draws `cell` clipped to one line. |
| Row actions as action columns | One 56px column per action, pinned right, never hidden, not in the gear menu. Use `actionColumn({ id, cell })`. If the card rows hide the action below `md` (`hideAt: 'md'`), keep the column by hand instead: `size: GRID_ACTION_COLUMN_SIZE` and `meta: { gridKind: 'action', hideAt: 'md', ... }`. `actionColumn()` sets no `hideAt`, so it would add the action to the card rows. |
| `selectionColumn()` first, only with a bulk action | The checkbox column: pinned left, selection in the table's `rowSelection` state. It is hidden in card rows. |
| `meta.label` in sentence case | The column's name in the gear menu ("Last login"). Without it the menu shows the header text, or the column id when the header is a node. |
| `settings.storageKey`, unique per table | Names the saved layout (hidden columns, order, widths) in the browser's storage. Two tables with one key share a layout. `settings={{}}` gives the gear with nothing kept. |

A column with no `meta.gridKind` is a data column: it can be resized, hidden and reordered, and the LAST data column
takes the free width. An `open` or `actions` column left as a data column is therefore not pinned, shows up in the
gear menu and stretches.

## Switching

Through the web app's `LiveTable`:

```tsx
<LiveTable table={table} pageSize={PAGE_SIZE} layout="grid" maxHeight="fill" settings={{ storageKey: 'employees-users' }} />
```

Through a feature table of this library (`FeatureTableLayoutProps`):

```tsx
<PoliciesTable rows={rows} layout="grid" tableMaxHeight="fill" tableSettings={{ storageKey: 'policies' }} />
```

With `DataTable` directly, the results count goes in `<DataTable.Meta>`, a direct child of `<DataTable>`:

```tsx
<DataTable table={table} layout="grid" maxHeight="fill" settings={{ storageKey: 'my-table' }}>
  <DataTable.Meta>
    <DataTable.RowCount itemName="device" totalCount={totalCount} />
  </DataTable.Meta>
  <DataTable.Header />
  <DataTable.Body loadingCells />
</DataTable>
```

## What the grid does not read

- `DataTable.Body`: `rowClassName`, `rowHeightClassName`, `compact`. Rows are 48px and touch.
- `meta.width` and `meta.hideAt`. A column the card rows hide below `lg` shows from `md` in the grid; the viewer hides
  columns in the gear menu instead.
- `DataTable.Header`'s `rightSlot`. The count sits above the table in `DataTable.Meta`.
- `stickyHeader` and `stickyHeaderOffset` once `maxHeight` is set: the header is sticky inside the table's own viewport.
- Sort on a column that also has a filter: the header draws the filter.

## Height

- No `maxHeight`: the page scrolls, the header sticks at `stickyHeaderOffset`, only the body scrolls sideways.
- A length (`360`, `'60vh'`): the table is its own scroll viewport, both ways.
- `'fill'`: the table takes the height the page leaves under its top, so the table scrolls and the page does not. It
  measures to the end of the nearest scrolling ancestor, less the bottom paddings in between. So: nothing below the
  table, one `fill` table per scrolling container, and not inside an embedded section that is itself part of a longer
  page.

## Feature tables: wired, not ready

These take `layout`, `tableMaxHeight` and `tableSettings` and pass them on. Their columns are still card-only, so each
needs the checklist above before a host asks it for the grid:

| Table | Still to do |
|---|---|
| `LogsTableView` | `size` / `minSize`, one-line `gridCell` for the two-line source and description cells, the row buttons (quick view, copy, open) as action columns, `meta.label` |
| `PoliciesTable` | `size` / `minSize`, `gridCell` for the name + description cell and the status with its note, `actions` and `open` as action columns |
| `ScriptsTable`, `ScriptSchedulesTable`, `ScriptExecutionsTable` | `size` / `minSize` in `scripts-table-columns.ts` (their `width` classes are card-only), `gridCell` for the name + description, date + time and initiator cells, `actions` and `open` as action columns |
| `KnowledgeBaseTableBody` | `size` / `minSize`, `gridCell` for the name cell (icon, name, status, summary), `open` and the host's `actionsColumn` as action columns |
| `TenantsTableView` (both variants) | `size` / `minSize`, `gridCell` for the tenant, customers and licences cells, `open` as an action column |
| `DeviceSelector` | `size` / `minSize`, `gridCell` for the device and customer cells, its add / remove column as an action column |

`DevicesTableBody` (`features/devices/devices-table-columns.tsx`) is the worked example: every column has a `size`, a
`minSize` and a `gridCell`, its open column is kept by hand, and it adds `selectionColumn()` itself.
