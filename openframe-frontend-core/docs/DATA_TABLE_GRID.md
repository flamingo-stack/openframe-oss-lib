# Moving a table to the grid layout

`<DataTable layout="grid">` draws one bordered table of 48px one-line rows, with pinned columns, column resize and
(with `settings`) a gear menu whose column layout is kept in the browser. It is the table at every width: a grid
table has no card form. The action columns are pinned right everywhere; the checkbox column and the first data column
are pinned left on a desktop with room for them (the window's `lg` step, 1280px, and at least 720px of content: the
content area's `md` step), and scroll with the other columns on a tablet, on a phone and in a desktop's narrow content
column. A table's `cell` renderers stay for the hosts that still ask for cards.

The layout is opt-in. A table that does not ask for it renders its card rows exactly as before.

## Before a table switches

Go through its column definitions:

| What | Why |
|---|---|
| `size` on every data column (px) | The grid lays columns out by `column.getSize()`. Without it a column is TanStack's default 150px. The `meta.width` classes are for card rows only. |
| `minSize` where the cell holds more than text | A column cannot be resized below it. The default is 120 (text). Use `GRID_MIN_WIDTH.icon` (148) for an icon and text, `GRID_MIN_WIDTH.media` (160) for a picture or an avatar and text. |
| `meta.gridCell` | The cell's form in the grid: ONE line, normally a `DataTable.Cell` (leading icon / picture / avatar, text, tag, secondary text, trailing mark). When the column is narrow the text gives way first; a long secondary text (an email, a reason) is cut once the text is down to its first 9 characters, a short one and a tag never are. `tone="secondary"` mutes the text of a row whose subject is gone. `cell` stays the card form. A column without `gridCell` draws `cell` clipped to one line. |
| Row actions as action columns | One 56px column per action, pinned right, never hidden, not in the gear menu. Use `actionColumn({ id, cell })`. If the same columns also serve a cards table that hides the action from `md` (`hideAt: 'md'`), keep the column by hand instead: `size: GRID_ACTION_COLUMN_SIZE` and `meta: { gridKind: 'action', hideAt: 'md', ... }`. `actionColumn()` sets no `hideAt`, so it would add the action to that cards table. |
| `selectionColumn()` first, only with a bulk action | The checkbox column: pinned left, selection in the table's `rowSelection` state. A cards table does not draw it. |
| `meta.dateFilter` on a column that sorts and filters by date | The header draws the label and a calendar and opens the date menu (a sort direction and a range, committed on Apply); a set range or a direction that is not the list's own shows as applied. Pass the applied `sortDirection` and `range` and an `onApply`, and give the column a text `header`: a control passed as the header node is drawn as it is, with a card header's look. The cards layout does not read `meta.dateFilter`. |
| `meta.label` in sentence case | The column's name in the gear menu ("Last login"). Without it the menu shows the header text, or the column id when the header is a node. |
| `loading` on `DataTable.Header` | Pass it what the body gets. A loading table names no column: each data header cell is a bar with no control, because the columns a loading table draws are not always the ones it loads with (a column behind a flag still being read, the viewer's saved order). A table that loads by a page loading scope needs nothing. |
| `settings.storageKey`, unique per table | Names the saved layout (hidden columns, order, widths) in the browser's storage. Two tables with one key share a layout. `settings={{}}` gives the gear with nothing kept. |

A column with no `meta.gridKind` is a data column: it can be resized, hidden and reordered, and the LAST data column
takes the free width. An `open` or `actions` column left as a data column is therefore not pinned, shows up in the
gear menu and stretches.

A data column with `enableHiding: false` stays in the table: its row in the gear menu cannot hide it, and a stored
layout that hides it is not applied to it. It can still be moved. Only the column's own flag counts (`gridCanHide`):
the table-level TanStack option does not change the grid.

## Pinning the first column on every desktop window

`pinFirstColumn` on `<DataTable>` says when the left block (the checkbox column and the first data column) is pinned:

| Value | Pinned |
|---|---|
| `wide` (default) | On a desktop with room for it: the window at 1280px and the content area at 720px. |
| `desktop` | On every desktop window (1280px), also in a narrow content column (the Mingo panel docked beside the page). The first data column is then drawn at most 40% of the table's width, never below its `minSize`. A tablet and a phone still scroll it. |

Keep the default. `desktop` is for a table whose pinned action needs the row's name beside it: the device picker, where
the add button is pinned right and a sideways scroll would otherwise leave a plus with no device name. Pass it on
`<DataTable>` itself, inside that table's component, not through `FeatureTableLayoutProps`: it is the table's own
decision, not the host's. The option pins the first data column the viewer SHOWS (the gear menu reorders columns, with
no lock); give the column that must stay `enableHiding: false` so at least it cannot be hidden.

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
  <DataTable.Header loading={loading} />
  <DataTable.Body loading={loading} loadingCells />
</DataTable>
```

## What the grid does not read

- `DataTable.Body`: `rowClassName`, `rowHeightClassName`, `compact`. Rows are 48px and touch.
- `meta.width` and `meta.hideAt`. A column a cards table hides below `lg` shows at every width in the grid; the viewer
  hides columns in the gear menu instead.
- `DataTable.Header`'s `rightSlot`. The count sits above the table in `DataTable.Meta`.
- `stickyHeader` and `stickyHeaderOffset` once `maxHeight` is set: the header is sticky inside the table's own viewport.
- Sort and `meta.filter` on a column with `meta.dateFilter`: the header draws the date menu, which owns both.
- Sort on a column that also has a filter: the header draws the filter.

## Sub-rows

`DataTable.Body`'s `renderSubRow` draws a block under a row. In the grid that block is as wide as the VISIBLE table,
not as its own content or the columns: a long line in it wraps and adds nothing to the table's scroll width, and where
the columns are wider than the screen (a tablet, a phone) it is one screen wide and stays in view while the cells
scroll sideways. The host gives it no width of its own (no `w-0 min-w-full` wrapper); content the host forbids to wrap
is cut at the table's edge.

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
| `KnowledgeBaseTableBody` | `size` / `minSize`, `gridCell` for the name cell (icon, name, status, summary), `open` and the host's `actionsColumn` as action columns |

`ScriptsTable`, `ScriptSchedulesTable` and `ScriptExecutionsTable` are ready. Their layout is data
(`features/scripts/scripts-table-columns.ts`: per column a `size`, a `minSize`, a `label`, and `gridKind: 'action'` on
the row menu and the open button), read through `scriptsColumnSize()` and `scriptsColumnMeta()`; the one-line cells are
the `...GridCell` components beside the card cells (`script-cells.tsx`, `execution-cells.tsx`). A host that builds its
own columns on that layout (the web app's live Scripts tables) reads the same two helpers and cells.

`DevicesTableBody` (`features/devices/devices-table-columns.tsx`) is the worked example: every column has a `size`, a
`minSize` and a `gridCell`, its open column is kept by hand, and it adds `selectionColumn()` itself when the host
passes `selectable` (off by default: the devices list has no bulk action yet).

`DeviceSelector` is ready. Its device and customer cells are the devices list's (`DeviceNameGridCell` without the
unread mark, `OrganizationGridCell`); the time a card row prints under the name ("Last Online: 5m ago") sits beside
the status tag, and the customer's contact line is not drawn. Its add / remove column is an action column kept by
hand, with a grid form of its own: a bare icon button (a plus, the accent check for a device that is in, the trash on
the Selected tab), each named for a screen reader ("Add <device>"), and the reason a device cannot be added as the
control's tooltip, since a 56px cell has no room for the text a card row prints beside the button. The picker keeps
its own card (the tabs and the search row) around the table; "Add All Devices" or the device count sits above the
table in `DataTable.Meta`. With its add / remove column it passes `pinFirstColumn="desktop"`: the Device column (which
cannot be hidden) stays pinned beside the add button on every desktop window, also with the Mingo panel docked; in
criteria mode, with no add column, it keeps the shared rule.

`PoliciesTable` and `LogsTableView` are ready too. Both put a card row's two lines on one with
`GridTextWithDetailCell` (`features/feature-table-grid-cells.tsx`): the subject (a policy's name, a log's time, a
device) keeps its width and the detail after it (the description, the log id, the customer) is the part cut. Use it
where the second line is long; `DataTable.Cell`'s `secondary` is for a short one, which it keeps whole. `LogsTableView`
draws its Log ID header as the date header from its `dateFilter` prop, and takes the host's copy button in its grid
form (`<LogCopyIconButton grid />`).

`TenantsTableView` (`features/cloud-tenants`, both variants) is ready too: its one-line cells are in
`tenant-grid-cells.tsx`, and its open column is kept by hand because the card table hides it below `md` in one variant.

## Tables whose columns are the data's

`TestRunResults` (`ui/test-run.tsx`) and `QueryReportTable` (`ui/query-report-table/`) take `layout` too. Their
columns are the keys of the rows they are given, so the grid form has no settings gear and keeps no layout: a column
per key at the card rows' width (176px for a test run, `columnWidth` for a report), resizable for the session, each
cell the value on one line with a dash for none. While rows are read they draw the grid's own loading form on unnamed
columns. Both keep their own empty state outside the grid, and the report keeps its title bar and export above it;
the report's scrollbar track and edge fades are the card rows' only, since the grid scrolls inside itself. A compact
report (`variant="compact"`) ignores `layout`.
