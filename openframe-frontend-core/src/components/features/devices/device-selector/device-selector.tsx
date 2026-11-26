'use client';

import {
  createContext,
  type MouseEvent,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { cn } from '../../../../utils/cn';
import { formatRelativeTime } from '../../../../utils/date-utils';
import { CheckCircleIcon, MonitorIcon, PlusCircleIcon, TrashIcon } from '../../../icons-v2-generated';
import {
  Button,
  type ColumnDef,
  type ColumnFiltersState,
  DataTable,
  EntityImage,
  GRID_ACTION_COLUMN_SIZE,
  GRID_MIN_WIDTH,
  type OnChangeFn,
  type Row,
  type TabItem,
  TabNavigation,
  Tag,
  TruncateText,
  useDataTable,
} from '../../../ui';
import { DATA_TABLE_SKELETON_ROWS } from '../../../ui/data-table/utils';
import { FloatingTooltip } from '../../../ui/floating-tooltip';
import { InertWhileLoading, useLoadingScope } from '../../../ui/loading-scope';
import { dataTableLayoutProps } from '../../feature-table-layout';
import { OSTypeBadge } from '../../os-type-badge';
import { DeviceConnectivityIcon } from '../device-connectivity-icon';
import { formatLastOnline } from '../device-last-online';
import { DeviceLifecycleTag } from '../device-lifecycle-tag';
import { getDeviceName } from '../device-name';
import { useDeviceStatusDisplay } from '../device-status-display';
import {
  DEVICE_CONNECTIVITY_FILTER_SECTION,
  DEVICE_STATUS,
  deviceStatusFilterGroups,
  joinStatusFilterValue,
  splitStatusFilterValue,
  toUiDeviceStatus,
} from '../device-statuses';
import { DeviceTypeTile } from '../device-type-tile';
import { DevicesFilterToolbar } from '../devices-filter-toolbar';
import { DeviceNameGridCell, getDeviceFilterColumns, OrganizationGridCell } from '../devices-table-columns';
import { useDeviceImageUrl } from '../devices-view-config';
import type { DeviceFilters, DeviceRow } from '../types';
import { useTagFilterModal } from '../use-tag-filter-modal';
import { DeviceSelectionModeRadio } from './device-selection-mode-radio';
import type { DeviceSelectionMode, DeviceSelectorProps, SubTab } from './device-selector.types';
import { useDeviceSelector } from './use-device-selector';

const EMPTY_SET: ReadonlySet<string> = new Set();
const NOOP = () => {};
const DEFAULT_GET_DEVICE_KEY = (d: DeviceRow): string | undefined => d.machineId || d.id;

/** The CUSTOMER cell: the customer's image, name and primary contact. */
function CustomerCell({ device }: { device: DeviceRow }) {
  // While the device is read (a loading scope) the contact line is drawn too: its loading form is a bar.
  const loading = useLoadingScope();
  const fullImageUrl = useDeviceImageUrl(device.organizationImageUrl, device.organizationImageHash);
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EntityImage
        src={fullImageUrl}
        alt={device.organization || 'Customer'}
        className="size-10 shrink-0 content-md:size-10"
      />
      <div className="flex min-w-0 flex-col justify-center">
        <TruncateText>{device.organization || ''}</TruncateText>
        {(device.organizationEmail || loading) && (
          <TruncateText variant="h6" tone="secondary">
            {device.organizationEmail ?? ''}
          </TruncateText>
        )}
      </div>
    </div>
  );
}

/** The DEVICE cell: its type, its name and when it was last online; bars while the device is read. */
function DeviceCell({ device }: { device: DeviceRow }) {
  const loading = useLoadingScope();
  return (
    <div className="flex h-20 items-center gap-3">
      <DeviceConnectivityIcon
        connectivity={device.connectivity}
        lastSeen={device.last_seen || device.lastSeen}
        legacyIcon={<DeviceTypeTile type={device.type} />}
      />
      <div className="flex min-w-0 flex-col">
        <TruncateText>{getDeviceName(device)}</TruncateText>
        <TruncateText variant="h6" tone="secondary" loading={loading}>
          {formatLastOnline(device.last_seen || device.lastSeen)}
        </TruncateText>
      </div>
    </div>
  );
}

/** The STATUS cell: the device's status as its tag; the tag's loading form while the device is read. */
function StatusCell({ device }: { device: DeviceRow }) {
  if (useLoadingScope()) return <Tag loading label="" className="w-min" />;
  return <DeviceLifecycleTag status={device.status} connectivity={device.connectivity} className="w-min" />;
}

/** The add / remove control: static chrome, drawn real and inert while the device is read. */
function InertInScope({ children }: { children: ReactNode }) {
  return (
    <InertWhileLoading loading={useLoadingScope()} className="contents">
      {children}
    </InertWhileLoading>
  );
}

/* ───────────────────────── grid-layout cells: one 48px line each ───────────────────────── */

/**
 * The STATUS cell in the grid: the status tag with when the device was last online beside it. A card row prints that
 * time under the device's name ("Last Online: 5m ago"); a grid row has one line, so it sits with the status, as in the
 * devices list.
 */
function StatusGridCell({ device }: { device: DeviceRow }) {
  const loading = useLoadingScope();
  const lastSeen = device.last_seen || device.lastSeen;
  return (
    <DataTable.Cell
      tag={
        loading ? (
          <Tag loading label="" />
        ) : (
          <DeviceLifecycleTag status={device.status} connectivity={device.connectivity} />
        )
      }
      // While the device is read there is no time to print: the tag's own loading form is the cell.
      secondary={loading ? undefined : lastSeen ? formatRelativeTime(lastSeen) : 'Never'}
    />
  );
}

/** The add / remove control's icon in the grid: 20px, the size of every icon in a 48px row. */
const GRID_ACTION_ICON_SIZE = 20;

/** How long after the first tap a second one is still the same tap (a double tap's ghost), not a confirmation. */
const TOUCH_CONFIRM_GUARD_MS = 350;

/**
 * The grid's armed add / remove button. On a touch screen the first tap on it shows its tooltip ("Add <device>") and
 * applies nothing; the second tap applies. One at a time, held by the picker.
 */
interface ArmedGridAction {
  /** The table's row id. */
  rowId: string;
  /** What the button does to which device, "Add <device>": a row whose action flipped is no longer armed. */
  label: string;
  /** What a screen reader hears once it is armed ("Tap again to add <device>"). None for a disabled row's reason. */
  hint?: string;
  /** When it was armed (`Date.now()`), for {@link TOUCH_CONFIRM_GUARD_MS}. */
  at: number;
}

interface GridActionArming {
  armed: ArmedGridAction | null;
  arm: (next: ArmedGridAction) => void;
  /** Clears the armed button: any, or only `match` (a bubble closing clears its own row, never another). */
  disarm: (match?: Pick<ArmedGridAction, 'rowId' | 'label'>) => void;
}

const GridActionArmingContext = createContext<GridActionArming>({ armed: null, arm: NOOP, disarm: NOOP });

/**
 * Whether a click came from a finger: the click's own `pointerType` where the browser sends it as a PointerEvent, else
 * the last `pointerdown`'s (older WebKit sends a tap's click as a plain MouseEvent). A keyboard's click (`detail` 0) is
 * never a tap.
 */
function isTouchClick(event: MouseEvent<HTMLElement>, lastPointerType: string | undefined): boolean {
  if (event.detail === 0) return false;
  const native = event.nativeEvent;
  const own = typeof PointerEvent !== 'undefined' && native instanceof PointerEvent ? native.pointerType : '';
  return (own || lastPointerType) === 'touch';
}

interface GridRowActionProps {
  /** The table's row id: which button is armed. */
  rowId: string;
  /** `add` or `remove`, and the device's name: the control's name for a screen reader ("Add <device>"). */
  action: 'add' | 'remove';
  deviceName: string;
  icon: ReactNode;
  /** `added`: the device is in the selection (the accent check). `remove`: the Selected tab's trash. */
  tone?: 'default' | 'added' | 'remove';
  onClick?: () => void;
  disabled?: boolean;
  /** Why the device cannot be added: shown on hover and focus, since a 56px cell has no room for the text. */
  reason?: string;
}

/**
 * The add / remove control in the grid: a bare 40px icon button, the action cell being its frame (the design's
 * `action-button`). A card row draws it outlined, with a fill for "added" and the disabled reason as text beside it;
 * here "added" is the accent check and the button's tooltip says what it does to which device ("Add <device>"), with
 * the reason after it. The column is pinned right at every width while the Device column scrolls away where the table
 * is narrow (a tablet, a phone, a desktop's narrow content column), so the tooltip is what names a scrolled row's device.
 *
 * A touch screen opens no tooltip on hover and a tap would apply at once, so a finger confirms instead: the first tap
 * shows the tooltip and applies nothing, a second tap on the same button applies (one within
 * {@link TOUCH_CONFIRM_GUARD_MS} of the first is ignored). A mouse, a pen and the keyboard apply at once. A disabled
 * row's tap shows the reason; there is nothing to confirm.
 */
function GridRowAction({
  rowId,
  action,
  deviceName,
  icon,
  tone = 'default',
  onClick,
  disabled,
  reason,
}: GridRowActionProps) {
  const { armed, arm, disarm } = useContext(GridActionArmingContext);
  // The last `pointerdown`'s pointer, read by the click that follows it (see `isTouchClick`).
  const pointerTypeRef = useRef<string | undefined>(undefined);
  const bubbleId = useId();

  const label = `${action === 'add' ? 'Add' : 'Remove'} ${deviceName}`;
  const tooltip = reason ? `${label}: ${reason}` : label;
  const isArmed = armed?.rowId === rowId && armed.label === label;

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    const touch = isTouchClick(event, pointerTypeRef.current);
    pointerTypeRef.current = undefined;
    if (!touch) {
      if (!onClick) return;
      disarm({ rowId, label });
      onClick();
      return;
    }
    if (!isArmed) {
      arm({ rowId, label, hint: reason ? undefined : `Tap again to ${action} ${deviceName}`, at: Date.now() });
      return;
    }
    if (!onClick || Date.now() - armed.at < TOUCH_CONFIRM_GUARD_MS) return;
    disarm({ rowId, label });
    onClick();
  };

  const handleOpenChange = (open: boolean) => {
    // Escape, a press outside or the pointer leaving closes the armed bubble; a mouse opening another row's tooltip
    // takes the place of the armed one: one bubble at a time.
    if (open) {
      if (armed && !isArmed) disarm();
    } else if (isArmed) {
      disarm({ rowId, label });
    }
  };

  const describedBy = isArmed ? bubbleId : undefined;
  const button = (
    <Button
      variant="transparent"
      size="icon"
      type="button"
      aria-label={label}
      aria-pressed={tone === 'added' ? true : undefined}
      aria-describedby={reason ? undefined : describedBy}
      onClick={reason ? undefined : handleClick}
      leftIcon={icon}
      className={cn(
        'size-10 border-0 md:size-10',
        tone === 'added' && 'text-ods-accent hover:text-ods-accent',
        tone === 'remove' && 'text-ods-error hover:opacity-80',
        tone === 'default' && 'text-ods-text-secondary hover:text-ods-text-primary',
      )}
      disabled={disabled}
    />
  );
  return (
    <div
      data-no-row-click
      className="pointer-events-auto flex items-center justify-center"
      onPointerDown={event => {
        pointerTypeRef.current = event.pointerType;
      }}
    >
      <FloatingTooltip
        content={tooltip}
        side="left"
        as="span"
        triggerClassName="inline-flex"
        open={isArmed || undefined}
        onOpenChange={handleOpenChange}
        mouseOnly
        contentId={bubbleId}
      >
        {reason ? (
          // A disabled button takes no hover, focus or tap: the wrapper is what the tooltip listens on.
          <span
            tabIndex={0}
            aria-label={tooltip}
            aria-describedby={describedBy}
            className="inline-flex rounded-md outline-none"
            onClick={handleClick}
          >
            {button}
          </span>
        ) : (
          button
        )}
      </FloatingTooltip>
    </div>
  );
}

/** A device still being read: a row the table keys, nothing a cell can show (every cell draws its loading form). */
function loadingDevices<T extends DeviceRow>(count: number): T[] {
  return Array.from({ length: count }, (_, index) => ({ id: `loading-${index}`, machineId: '', status: '' }) as T);
}

/**
 * Selection-oriented devices list. Sits next to `DevicesPanel` (the listing
 * page), but the data model is different and intentional:
 *
 * - **Data is owned by the parent.** The consumer passes a pre-fetched
 *   `devices: Device[]` and (optionally) an `infiniteScroll` config. This is
 *   because consumers fetch from different backends, GraphQL `devices` query
 *   (TestScriptModal, ScheduleAssignDevicesView), Tactical RMM REST
 *   (RunScriptView), Fleet MDM (monitoring queries/policies). A single
 *   internal `useDevices` wouldn't fit all of them.
 *
 * - **Filtering is client-side.** Column filter funnels (status/customer) and
 *   tag chips operate on the `devices` array via `Array.filter`. Filter
 *   options shown in the dropdowns are derived from the same array (no extra
 *   network call). Trade-off: if the parent passes a partial page, the
 *   filters see only that page, not the full dataset on the server.
 *
 * - **Pagination is parent-driven via `infiniteScroll`.** The component just
 *   renders `DataTable.InfiniteFooter` and calls `onLoadMore`. The consumer
 *   owns the fetching strategy. In practice all current consumers fetch the
 *   full list (≤100 devices) and don't pass `infiniteScroll` at all.
 *
 * For a server-driven listing with URL state, GraphQL pagination and filter
 * counts coming from the backend, use `DevicesPanel` instead.
 *
 * Two opt-in modes change the picture above:
 *
 * - **`server`** hands search, filtering, paging and the bulk actions to the
 *   parent's backend, see {@link DeviceSelectorServer}.
 * - **`selectionMode` + `criteriaContent`** swap the picker for the rule editor
 *   of "Select Devices by Criteria": `criteriaContent` replaces the card
 *   entirely, the search toolbar and row actions go away, and the table becomes
 *   a live preview of what the rule matches.
 */
export function DeviceSelector<T extends DeviceRow = DeviceRow>({
  devices,
  loading: loadingProp,
  loadingRegion,
  skeletonRows,
  selectedIds: selectedIdsProp,
  onSelectionChange: onSelectionChangeProp,
  getDeviceKey: getDeviceKeyProp,
  infiniteScroll,
  disabled = false,
  showSelectionModeRadio = true,
  headerContent,
  addAllBehavior = 'merge',
  singleSelect = false,
  isDeviceDisabled,
  hideColumns,
  showToolbar = true,
  totalCount,
  server,
  selectionMode,
  onSelectionModeChange,
  criteriaContent,
  layout = 'cards',
  tableMaxHeight,
  tableSettings,
}: DeviceSelectorProps<T>) {
  // ONE switch: in a page's loading state (or while the host reads the devices) the header, its row count and the
  // table draw as their loading state.
  const loading = useLoadingScope() || loadingProp;
  const selectedIds = (selectedIdsProp ?? EMPTY_SET) as Set<string>;
  const onSelectionChange = onSelectionChangeProp ?? NOOP;
  const getDeviceKey = getDeviceKeyProp ?? DEFAULT_GET_DEVICE_KEY;
  // Criteria mode replaces the whole picker, card, tabs and search row, with
  // the rule editor over a read-only preview of what that rule resolves to.
  const isCriteria = selectionMode === 'criteria';
  // Called unconditionally (hooks rule); in server mode its results are simply
  // not the ones used, the parent's query already answered those questions.
  const client = useDeviceSelector({ devices, selectedIds, getDeviceKey });

  // The grid's add / remove button a finger armed (the first tap names the device, the second applies; see
  // `GridRowAction`). Anything that changes what the table lists clears it without applying.
  const [armedAction, setArmedAction] = useState<ArmedGridAction | null>(null);
  const disarmGridAction = useCallback((match?: Pick<ArmedGridAction, 'rowId' | 'label'>) => {
    setArmedAction(current =>
      current && match && (current.rowId !== match.rowId || current.label !== match.label) ? current : null,
    );
  }, []);

  const searchTerm = server ? server.search : client.searchTerm;
  const changeSearchTerm = server ? server.onSearchChange : client.setSearchTerm;
  const setSearchTerm = useCallback(
    (value: string) => {
      setArmedAction(null);
      changeSearchTerm(value);
    },
    [changeSearchTerm],
  );
  const activeSubTab = server ? server.activeTab : client.activeSubTab;
  const handleTabChange = useMemo(() => {
    const changeTab = server ? (tabId: string) => server.onTabChange(tabId as SubTab) : client.handleTabChange;
    return (tabId: string) => {
      setArmedAction(null);
      changeTab(tabId);
    };
  }, [server, client.handleTabChange]);

  // Read latest selectedIds via ref so toggleDevice can stay reference-stable.
  // The DataTable rows are React.memo'd; rows that don't re-render keep an old
  // toggleDevice closure, and a stale closure that captured an outdated
  // selectedIds would corrupt the set on the next click.
  const selectedIdsRef = useRef(selectedIds);
  // Latest-value refs, written after the commit rather than during render:
  // a render-phase ref write is what `react-hooks/refs` forbids, and every
  // reader below runs in an effect, a timer or an event handler.
  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  });

  const [clientColumnFilters, setClientColumnFilters] = useState<ColumnFiltersState>([]);
  const [clientTags, setClientTags] = useState<string[]>([]);

  const columnFilters = server ? server.narrowing.columnFilters : clientColumnFilters;
  const selectedTags = server ? server.narrowing.tags : clientTags;

  const setColumnFilters = useCallback(
    (next: ColumnFiltersState) => {
      setArmedAction(null);
      if (server) server.onNarrowingChange({ columnFilters: next, tags: server.narrowing.tags });
      else setClientColumnFilters(next);
    },
    [server],
  );

  // TanStack hands either a value or an updater fn; resolve it against what is
  // on screen before it reaches the (possibly lifted) setter above.
  const handleTableColumnFiltersChange = useCallback<OnChangeFn<ColumnFiltersState>>(
    updaterOrValue => {
      setColumnFilters(typeof updaterOrValue === 'function' ? updaterOrValue(columnFilters) : updaterOrValue);
    },
    [columnFilters, setColumnFilters],
  );

  const setSelectedTags = useCallback(
    (next: string[]) => {
      setArmedAction(null);
      if (server) server.onNarrowingChange({ columnFilters: server.narrowing.columnFilters, tags: next });
      else setClientTags(next);
    },
    [server],
  );

  const clientToggleDevice = useCallback(
    (device: T) => {
      if (disabled) return;
      if (isDeviceDisabled?.(device)) return;
      const key = getDeviceKey(device);
      if (key === undefined) return;

      const current = selectedIdsRef.current;
      if (singleSelect) {
        onSelectionChange(current.has(key) ? new Set() : new Set([key]));
        return;
      }

      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      onSelectionChange(next);
    },
    [disabled, isDeviceDisabled, getDeviceKey, onSelectionChange, singleSelect],
  );

  // In server mode the Selected tab can only ever remove. The Available tab
  // holds the whole candidate set, assigned devices included, marked as such by
  // the backend, so there the row does flip: a marked row removes, an unmarked
  // one adds. Read through the ref for the same reason `clientToggleDevice`
  // does: memoized rows keep the closure they were rendered with.
  const toggleDevice = useCallback(
    (device: T) => {
      if (!server) {
        clientToggleDevice(device);
        return;
      }
      if (disabled) return;
      if (isDeviceDisabled?.(device)) return;
      if (server.activeTab === 'selected') {
        server.onRemove(device);
        return;
      }
      const key = getDeviceKey(device);
      if (key !== undefined && selectedIdsRef.current.has(key)) server.onRemove(device);
      else server.onAdd(device);
    },
    [server, clientToggleDevice, disabled, isDeviceDisabled, getDeviceKey],
  );

  const removeAllSelected = useCallback(() => {
    if (disabled) return;
    setArmedAction(null);
    if (server) {
      server.onRemoveAll();
      return;
    }
    onSelectionChange(new Set());
  }, [disabled, server, onSelectionChange]);

  // Tag chips in the search bar take "key:value" form (e.g. "env:prod").
  // A chip without a key filters nothing (matches DevicesPanel behavior).
  const selectedTagValues = useMemo(
    () =>
      selectedTags.flatMap(t => {
        const i = t.indexOf(':');
        return i > 0 ? [t.substring(i + 1)] : [];
      }),
    [selectedTags],
  );

  // Apply column filters + tag filters client-side on top of the search/tab-filtered list.
  // singleSelect mode skips the tab split and shows all matching devices.
  // In server mode there is nothing to apply: `devices` is already the answer
  // to this tab, this search and these filters.
  // Criteria mode is the same deal as server mode: `devices` is already the
  // answer, here, the set the rule resolves to.
  const passThrough = !!server || isCriteria;
  const baseDevices = passThrough ? devices : singleSelect ? client.filteredDevices : client.displayDevices;
  /** The column filters (status, OS, customer) and the tag chips, as one test of a device. */
  const matchesVisibleFilters = useCallback(
    (d: T) => {
      for (const f of columnFilters) {
        const raw = f.value as string[];
        if (!raw || raw.length === 0) continue;
        // The STATUS funnel also holds the Connectivity group's picks (`connectivity:ONLINE`).
        const { statuses: values, connectivity } =
          f.id === 'status' ? splitStatusFilterValue(raw) : { statuses: raw, connectivity: [] as string[] };
        if (connectivity.length > 0 && !connectivity.includes((d.connectivity ?? 'OFFLINE').toUpperCase())) {
          return false;
        }
        if (values.length === 0) continue;
        const cell =
          f.id === 'status'
            ? // The UI value: MANAGED stands for the legacy ONLINE / OFFLINE too.
              toUiDeviceStatus(d.status)
            : f.id === 'os'
              ? d.osType
              : f.id === 'organization'
                ? // Same key the option was built from, id first, name only for
                  // rows that have no id.
                  (d.organizationId ?? d.organization)
                : undefined;
        if (cell === undefined || !values.includes(cell)) return false;
      }
      if (selectedTagValues.length > 0) {
        const hasMatchingTag = (d.tags ?? []).some(tag => tag.values.some(v => selectedTagValues.includes(v)));
        if (!hasMatchingTag) return false;
      }
      return true;
    },
    [columnFilters, selectedTagValues],
  );
  const devicesForTable = useMemo(() => {
    if (passThrough || (columnFilters.length === 0 && selectedTagValues.length === 0)) return baseDevices;
    return baseDevices.filter(matchesVisibleFilters);
  }, [passThrough, baseDevices, columnFilters, selectedTagValues, matchesVisibleFilters]);

  const addAllDevices = useCallback(() => {
    if (disabled) return;
    setArmedAction(null);
    if (server) {
      server.onAddAll();
      return;
    }
    const base = addAllBehavior === 'replace' ? new Set<string>() : new Set(selectedIds);
    // Only what the table can show: a device the status, OS, customer or tag filter hides is never added unseen.
    for (const d of client.filteredDevices) {
      if (!matchesVisibleFilters(d)) continue;
      if (isDeviceDisabled?.(d)) continue;
      const key = getDeviceKey(d);
      if (key !== undefined) {
        base.add(key);
      }
    }
    onSelectionChange(base);
  }, [
    disabled,
    server,
    isDeviceDisabled,
    addAllBehavior,
    selectedIds,
    client.filteredDevices,
    matchesVisibleFilters,
    getDeviceKey,
    onSelectionChange,
  ]);

  // Client-side `DeviceFilters`-shaped object, built from the prop list so
  // `useTagFilterModal` and `getDeviceFilterColumns` can drive the FilterModal
  // without a network round-trip.
  const clientDeviceFilters = useMemo<DeviceFilters>(() => {
    const statusCounts = new Map<string, number>();
    const connectivityCounts = new Map<string, number>();
    const osCounts = new Map<string, number>();
    const orgCounts = new Map<string, { label: string; count: number }>();
    const tagSeen = new Map<string, Map<string, number>>();

    for (const d of devices) {
      if (d.status) {
        const status = toUiDeviceStatus(d.status);
        statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
      }
      const connectivity = (d.connectivity ?? 'OFFLINE').toUpperCase();
      connectivityCounts.set(connectivity, (connectivityCounts.get(connectivity) ?? 0) + 1);
      if (d.osType) osCounts.set(d.osType, (osCounts.get(d.osType) ?? 0) + 1);
      // Keyed by id, labelled by name, the mobile FilterModal writes the VALUE
      // into the same `organization` column filter the funnels above do.
      const orgKey = d.organizationId ?? d.organization;
      if (orgKey) {
        const existing = orgCounts.get(orgKey);
        orgCounts.set(orgKey, { label: d.organization ?? orgKey, count: (existing?.count ?? 0) + 1 });
      }
      for (const tag of d.tags ?? []) {
        const vc = tagSeen.get(tag.key) ?? new Map<string, number>();
        tagSeen.set(tag.key, vc);
        for (const v of tag.values) vc.set(v, (vc.get(v) ?? 0) + 1);
      }
    }

    const tagKeys: Array<{ key: string; value: string; count: number }> = [];
    for (const [key, vc] of tagSeen) {
      for (const [value, count] of vc) {
        tagKeys.push({ key, value, count });
      }
    }

    return {
      statuses: Array.from(statusCounts, ([value, count]) => ({ value, count })),
      connectivity: Array.from(connectivityCounts, ([value, count]) => ({ value, count })),
      deviceTypes: [],
      osTypes: Array.from(osCounts, ([value, count]) => ({ value, count })),
      organizationIds: Array.from(orgCounts, ([value, { label, count }]) => ({ value, label, count })),
      tagKeys,
      filteredCount: devices.length,
    };
  }, [devices]);

  // Counting the rows on screen only describes the page the client happens to
  // hold; when the server is paging, it supplies the real facets instead.
  const deviceFilters = server?.filterOptions ?? clientDeviceFilters;

  // Counts ride along only when the facets are the server's. The client-side
  // ones describe the page in hand, which is not what a count claims to answer.
  const serverFaceted = Boolean(server?.filterOptions);
  const statusDisplay = useDeviceStatusDisplay();
  const filterColumns = useMemo(() => {
    const columns = getDeviceFilterColumns(deviceFilters, { statusDisplay });
    if (serverFaceted) return columns;
    return columns.map(column => ({
      ...column,
      filterOptions: column.filterOptions?.map(({ count: _count, ...option }) => option),
    }));
  }, [deviceFilters, serverFaceted, statusDisplay]);

  // The column funnels read `deviceFilters`, the SERVER's facets whenever the
  // consumer is server-narrowed, rather than the rows in hand.
  //
  // They used to be derived from the `devices` prop, and in server mode that is
  // the narrowed page: picking one customer left the funnel holding only that
  // customer, so the second one became unpickable and the filter closed behind
  // the first click. In client mode nothing changes, `deviceFilters` IS the
  // row-derived object there, and those rows are the unfiltered prop list.
  //
  // Same source as the mobile FilterModal below, so the two can no longer offer
  // different things.
  const statusFilterOptions = useMemo(() => {
    const options = filterColumns.find(column => column.key === 'status')?.filterOptions ?? [];
    // ARCHIVED last: it is a state a device leaves the fleet in, not one anybody
    // filters by first.
    return [...options].sort((a, b) => {
      if (a.value === DEVICE_STATUS.ARCHIVED) return 1;
      if (b.value === DEVICE_STATUS.ARCHIVED) return -1;
      return 0;
    });
  }, [filterColumns]);

  const connectivitySections = useMemo(() => {
    const options = filterColumns.find(column => column.key === DEVICE_CONNECTIVITY_FILTER_SECTION)?.filterOptions;
    return options && options.length > 0
      ? [{ id: DEVICE_CONNECTIVITY_FILTER_SECTION, title: 'Connectivity', options }]
      : undefined;
  }, [filterColumns]);

  // The funnel's VALUE is the customer id, that is what a server-narrowed
  // consumer puts into `organizationIds`, and a name sent there matches nothing.
  // `getDeviceFilterColumns` keys these by id and labels them by name, and the
  // client-side matcher below compares the same id, so the two stay in step.
  const orgFilterOptions = useMemo(
    () => filterColumns.find(column => column.key === 'organization')?.filterOptions ?? [],
    [filterColumns],
  );

  // Adapter: useTagFilterModal expects a single `setParams({ statuses, osTypes, organizationIds, tags })`
  // call. We split it back into our local state.
  const handleSetParams = useCallback(
    (params: Record<string, string[]>) => {
      setColumnFilters([
        ...(params.statuses?.length || params.connectivity?.length
          ? [{ id: 'status', value: joinStatusFilterValue(params.statuses ?? [], params.connectivity ?? []) }]
          : []),
        ...(params.osTypes?.length ? [{ id: 'os', value: params.osTypes }] : []),
        ...(params.organizationIds?.length ? [{ id: 'organization', value: params.organizationIds }] : []),
      ]);
      setSelectedTags(params.tags ?? []);
    },
    [setColumnFilters, setSelectedTags],
  );

  const {
    isOpen: tagsModalOpen,
    open: openTagsModal,
    close: closeTagsModal,
    isMdUp,
    filterGroups,
    tagFilterKeys,
    handleFilterChange: handleModalFilterChange,
    handleTagsChange: handleModalTagsChange,
  } = useTagFilterModal({
    tags: selectedTags,
    deviceFilters,
    columns: filterColumns,
    setParams: handleSetParams,
  });

  const tagOptions = useMemo(() => selectedTags.map(t => ({ label: t, value: t })), [selectedTags]);

  // Map column filters → `{ status, os, organization }` shape that FilterModal expects on mobile.
  const tableFilters = useMemo(() => {
    const status = splitStatusFilterValue(columnFilters.find(f => f.id === 'status')?.value as string[] | undefined);
    return {
      ...deviceStatusFilterGroups(status.statuses, status.connectivity, statusDisplay),
      os: (columnFilters.find(f => f.id === 'os')?.value as string[]) ?? [],
      organization: (columnFilters.find(f => f.id === 'organization')?.value as string[]) ?? [],
    };
  }, [columnFilters, statusDisplay]);

  const handleTagRemove = useCallback(
    (value: string) => {
      setSelectedTags(selectedTags.filter(t => t !== value));
    },
    [selectedTags, setSelectedTags],
  );

  const handleClearAll = useCallback(() => {
    setSearchTerm('');
    setSelectedTags([]);
  }, [setSearchTerm, setSelectedTags]);

  const columns = useMemo<ColumnDef<T>[]>(
    () => [
      {
        id: 'device',
        accessorKey: 'device',
        header: 'DEVICE',
        cell: ({ row }: { row: Row<T> }) => <DeviceCell device={row.original} />,
        enableSorting: false,
        // The name says which device a row adds: the grid's settings menu cannot hide it.
        enableHiding: false,
        size: 280,
        minSize: GRID_MIN_WIDTH.icon,
        meta: {
          label: 'Device',
          gridCell: ({ row }) => <DeviceNameGridCell device={row.original} unreadMark={false} />,
        },
      },
      {
        id: 'organization',
        accessorKey: 'organization',
        header: 'CUSTOMER',
        cell: ({ row }: { row: Row<T> }) => <CustomerCell device={row.original} />,
        enableSorting: false,
        size: 280,
        minSize: GRID_MIN_WIDTH.media,
        meta: {
          label: 'Customer',
          // The logo and the name, as in the devices list. The contact a card row prints under the name has no line
          // of its own here, and beside the name it would take the name's width.
          gridCell: ({ row }) => <OrganizationGridCell device={row.original} />,
          width: 'w-[320px]',
          hideAt: 'lg',
          filter: { options: orgFilterOptions, placement: 'bottom-end' },
        },
      },
      {
        id: 'os',
        accessorKey: 'os',
        header: 'OS',
        cell: ({ row }: { row: Row<T> }) => (
          <OSTypeBadge osType={row.original.osType} iconSize="w-4 h-4 content-md:w-6 content-md:h-6" />
        ),
        enableSorting: false,
        size: 160,
        minSize: GRID_MIN_WIDTH.icon,
        meta: {
          label: 'OS',
          gridCell: ({ row }) => (
            <OSTypeBadge osType={row.original.osType} iconSize="w-5 h-5" className="min-w-0 truncate" />
          ),
          width: 'w-[200px] content-md:w-1/6',
          hideAt: 'md',
        },
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'STATUS',
        cell: ({ row }: { row: Row<T> }) => <StatusCell device={row.original} />,
        enableSorting: false,
        // The tag and a relative time beside it ("3d ago").
        size: 220,
        meta: {
          label: 'Status',
          gridCell: ({ row }) => <StatusGridCell device={row.original} />,
          width: 'w-auto shrink-0 content-md:w-[160px]',
          filter: { options: statusFilterOptions, sections: connectivitySections },
        },
      },
      {
        id: 'actions',
        cell: ({ row }: { row: Row<T> }) => (
          <InertInScope>
            {((): ReactNode => {
              const device = row.original;
              const disabledReason = isDeviceDisabled?.(device);

              if (disabledReason) {
                return (
                  <div data-no-row-click className="pointer-events-auto flex w-full items-center justify-end gap-2">
                    <span className="whitespace-pre-line text-right text-ods-text-secondary text-h6 content-max-md:hidden">
                      {disabledReason}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      leftIcon={<PlusCircleIcon size={24} />}
                      className="shrink-0 text-ods-text-secondary"
                      disabled
                    />
                  </div>
                );
              }

              const key = getDeviceKey(device);
              if (key === undefined) return null;
              // Server mode fills `selectedIds` from the connection's own
              // per-row flag, so "already in?" is answered by the backend rather
              // than by whichever page the client happens to hold.
              const isSelected = selectedIds.has(key);

              if (activeSubTab === 'selected') {
                return (
                  <div data-no-row-click className="pointer-events-auto flex w-full items-center justify-end">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => toggleDevice(device)}
                      leftIcon={<TrashIcon size={24} />}
                      className="text-ods-error hover:opacity-80"
                      disabled={disabled}
                    />
                  </div>
                );
              }

              return (
                <div data-no-row-click className="pointer-events-auto flex w-full items-center justify-end">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleDevice(device)}
                    leftIcon={isSelected ? <CheckCircleIcon size={24} /> : <PlusCircleIcon size={24} />}
                    // Selected is a STATE, not an affordance: the yellow fill already
                    // says "this one is in", so it holds still under the cursor. The
                    // hover repeats on both bg and border because `variant="outline"`
                    // ships its own `hover:bg-ods-bg-hover` / `hover:border-ods-border-hover`
                    //, restating them at the same value is what neutralizes them.
                    className={
                      isSelected
                        ? 'border-ods-accent bg-ods-open-yellow-secondary text-ods-accent hover:border-ods-accent hover:bg-ods-open-yellow-secondary'
                        : 'text-ods-text-secondary hover:text-ods-text-primary'
                    }
                    disabled={disabled}
                  />
                </div>
              );
            })()}
          </InertInScope>
        ),
        enableSorting: false,
        enableHiding: false,
        size: GRID_ACTION_COLUMN_SIZE,
        meta: {
          width: 'w-12 content-md:w-auto content-md:min-w-[130px] shrink-0 flex-none',
          align: 'right',
          // In the grid the control is an action column: 56px, pinned right, not in the gear menu.
          gridKind: 'action',
          gridCell: ({ row }) => (
            <InertInScope>
              {((): ReactNode => {
                const device = row.original;
                const name = getDeviceName(device);
                const disabledReason = isDeviceDisabled?.(device);
                if (disabledReason) {
                  return (
                    <GridRowAction
                      rowId={row.id}
                      action="add"
                      deviceName={name}
                      icon={<PlusCircleIcon size={GRID_ACTION_ICON_SIZE} />}
                      reason={disabledReason}
                      disabled
                    />
                  );
                }

                const key = getDeviceKey(device);
                if (key === undefined) return null;
                if (activeSubTab === 'selected') {
                  return (
                    <GridRowAction
                      rowId={row.id}
                      action="remove"
                      deviceName={name}
                      icon={<TrashIcon size={GRID_ACTION_ICON_SIZE} />}
                      tone="remove"
                      onClick={() => toggleDevice(device)}
                      disabled={disabled}
                    />
                  );
                }

                const isSelected = selectedIds.has(key);
                return (
                  <GridRowAction
                    rowId={row.id}
                    action={isSelected ? 'remove' : 'add'}
                    deviceName={name}
                    icon={
                      isSelected ? (
                        <CheckCircleIcon size={GRID_ACTION_ICON_SIZE} />
                      ) : (
                        <PlusCircleIcon size={GRID_ACTION_ICON_SIZE} />
                      )
                    }
                    tone={isSelected ? 'added' : 'default'}
                    onClick={() => toggleDevice(device)}
                    disabled={disabled}
                  />
                );
              })()}
            </InertInScope>
          ),
        },
      },
    ],
    [
      statusFilterOptions,
      connectivitySections,
      orgFilterOptions,
      isDeviceDisabled,
      getDeviceKey,
      selectedIds,
      activeSubTab,
      toggleDevice,
      disabled,
    ],
  );

  const visibleColumns = useMemo(() => {
    // Nothing on a criteria row is actionable, membership follows the rule, so
    // an add/remove button there would promise an edit the mode cannot make.
    const hidden = new Set([...(hideColumns ?? []), ...(isCriteria ? ['actions'] : [])]);
    if (hidden.size === 0) return columns;
    return columns.filter(c => !c.id || !hidden.has(c.id));
  }, [columns, hideColumns, isCriteria]);

  // While loading the table holds one page of placeholder rows, drawn with the real cells (`loadingCells`).
  const loadingRows = useMemo(
    () => (loading ? loadingDevices<T>(skeletonRows ?? DATA_TABLE_SKELETON_ROWS) : null),
    [loading, skeletonRows],
  );
  const getRowId = useCallback((row: T) => String(getDeviceKey(row) ?? row.id), [getDeviceKey]);
  const table = useDataTable<T>({
    data: loadingRows ?? devicesForTable,
    columns: visibleColumns,
    getRowId,
    enableSorting: false,
    state: { columnFilters },
    onColumnFiltersChange: handleTableColumnFiltersChange,
  });

  const selectedCount = server ? server.selectedCount : selectedIds.size;

  // Per-row className whose value differs by selection state. DataTableRow is
  // React.memo'd on `className`, so only rows whose selection actually flipped
  // re-render, the rest keep their cached cells (with stable toggleDevice).
  const rowClassName = useCallback(
    (device: T): string => {
      const key = getDeviceKey(device);
      if (key === undefined) return '';
      return selectedIds.has(key) ? 'is-selected' : '';
    },
    [selectedIds, getDeviceKey],
  );

  const assignTabs: TabItem[] = useMemo(
    () => [
      {
        id: 'available',
        label: 'Available Devices',
        icon: MonitorIcon,
        // The table is rendered outside TabContent now, these `component` slots
        // exist only because TabNavigation/TabItem require them. Render nothing.
        component: () => null,
      },
      {
        id: 'selected',
        // Server mode counts the whole assignment, not the page in hand.
        label: singleSelect ? `Selected Device (${selectedCount})` : `Selected Devices (${selectedCount})`,
        icon: CheckCircleIcon,
        component: () => null,
      },
    ],
    [selectedCount, singleSelect],
  );

  const availableInfiniteScroll = activeSubTab === 'available' ? infiniteScroll : undefined;
  const loadMore = availableInfiniteScroll?.onLoadMore;
  const handleLoadMore = useCallback(() => {
    setArmedAction(null);
    loadMore?.();
  }, [loadMore]);

  const handleSelectionModeChange = useMemo(
    () =>
      onSelectionModeChange &&
      ((mode: DeviceSelectionMode) => {
        setArmedAction(null);
        onSelectionModeChange(mode);
      }),
    [onSelectionModeChange],
  );

  // The armed row left the list (the host's data changed under it, a criteria preview took the table, the rows went
  // back to loading): it is cleared, not kept for the row's return. Set during render, as React's "adjusting state when
  // a prop changes" does, so the bubble never draws for a row that is gone.
  const armedRowListed =
    armedAction !== null &&
    !isCriteria &&
    !loading &&
    !disabled &&
    devicesForTable.some(device => getRowId(device) === armedAction.rowId);
  if (armedAction !== null && !armedRowListed) setArmedAction(null);
  const armedGridAction = armedRowListed ? armedAction : null;
  const gridActionArming = useMemo<GridActionArming>(
    () => ({ armed: armedGridAction, arm: setArmedAction, disarm: disarmGridAction }),
    [armedGridAction, disarmGridAction],
  );

  // Column headers over nothing are just noise, drop them when the list is
  // empty. Except when the emptiness is the RESULT of narrowing (search, tag
  // chips, column funnels): the funnels live in that header, so tearing it down
  // would strip the only way to undo the filter that emptied the table. While
  // loading, the skeleton rows are the content the header belongs to.
  // The design (460:71435) puts the bulk action where a table normally shows its
  // row count, the right end of the column header, instead of on a line of its
  // own above the table. Null in single-select mode, and on the Selected tab
  // until there is something to remove; the row count takes the slot back then.
  const bulkAction =
    singleSelect || isCriteria ? null : activeSubTab === 'available' ? (
      <Button variant="link" size="compact" noPaddingX type="button" onClick={addAllDevices} disabled={disabled}>
        Add All Devices
      </Button>
    ) : selectedCount > 0 ? (
      <Button variant="link" size="compact" noPaddingX type="button" onClick={removeAllSelected} disabled={disabled}>
        Remove {server ? (server.totalCount ?? devicesForTable.length) : selectedIds.size} Devices
      </Button>
    ) : null;

  const hasActiveFilter = columnFilters.length > 0 || selectedTags.length > 0 || searchTerm.trim().length > 0;
  // In criteria mode the header's row count is the readout of the rule ("42
  // devices"), so it stays even at zero, that IS the answer the user is after.
  const showHeader = isCriteria || loading || devicesForTable.length > 0 || hasActiveFilter;

  // The header's right slot: the bulk action, or the row count where there is none.
  const headerSlot = bulkAction ?? (
    <DataTable.RowCount itemName="device" totalCount={totalCount ?? server?.totalCount} loading={loading} />
  );

  const deviceTable = (
    <GridActionArmingContext.Provider value={gridActionArming}>
      <DataTable table={table} {...dataTableLayoutProps({ layout, tableMaxHeight, tableSettings })}>
        {/* The grid shows the same slot above the table; the card header carries it at its right end. */}
        {showHeader && layout === 'grid' && <DataTable.Meta>{headerSlot}</DataTable.Meta>}
        {showHeader && <DataTable.Header rightSlot={headerSlot} loading={loading} />}
        <DataTable.Body
          loading={loading}
          loadingCells
          loadingRegion={loadingRegion}
          skeletonRows={skeletonRows}
          emptyMessage={
            isCriteria
              ? 'No devices match these criteria'
              : activeSubTab === 'selected'
                ? 'No devices selected'
                : 'No devices found'
          }
          rowClassName={rowClassName}
        />
        {availableInfiniteScroll && (
          <DataTable.InfiniteFooter
            hasNextPage={availableInfiniteScroll.hasNextPage}
            isFetchingNextPage={availableInfiniteScroll.isFetchingNextPage}
            onLoadMore={handleLoadMore}
            skeletonRows={availableInfiniteScroll.skeletonRows}
          />
        )}
      </DataTable>
      {/* A finger's first tap on a grid add / remove button arms it: say what the second tap does. Present before
          anything is armed, so the change is announced. The card layout has no two-step tap. */}
      {layout === 'grid' && (
        <p className="sr-only" role="status" aria-live="polite">
          {armedGridAction?.hint ?? ''}
        </p>
      )}
    </GridActionArmingContext.Provider>
  );

  return (
    // The page-level stack (info bar → mode picker → the picker card) uses
    // `--spacing-system-l`, the token every other stacked page surface in the app
    // separates its blocks with (16px mobile / 24px desktop).
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      {headerContent}

      {showSelectionModeRadio && (
        <DeviceSelectionModeRadio value={selectionMode} onChange={handleSelectionModeChange} disabled={disabled} />
      )}

      {/* Criteria mode (design 460:85294) has no card at all: the rule's fields
          and the table it previews sit straight on the page, in the same 24px
          stack as everything above them. There is nothing to frame, no tab
          strip to seat, and no search row to inset with it. */}
      {isCriteria ? (
        <>
          {criteriaContent}
          {deviceTable}
        </>
      ) : (
        /* Design 460:71435 frames the picker as ONE bordered card: the tab strip
           sits flush against the top edge with its own underline doubling as the
           divider, and the search row and table are inset below it.
           Deliberately NOT `overflow-clip` (which the Figma export puts here to
           round the tab strip's corners): the column-filter dropdowns are
           absolutely positioned INSIDE this box rather than portaled, so clipping
           it would cut them off whenever the table is short. The tab strip clips
           its own corners instead: it is the only child that reaches the radius. */
        <div className="flex flex-col rounded-[6px] border border-ods-border bg-ods-bg">
          {!singleSelect && (
            <TabNavigation
              tabs={assignTabs}
              staticLabels
              activeTab={activeSubTab}
              onTabChange={handleTabChange}
              className="overflow-clip rounded-t-[6px]"
            />
          )}

          <div className="flex flex-col gap-[var(--spacing-system-m)] p-[var(--spacing-system-m)]">
            {showToolbar && (
              <DevicesFilterToolbar
                sticky={false}
                searchValue={searchTerm}
                onSearchChange={setSearchTerm}
                tags={tagOptions}
                onTagRemove={handleTagRemove}
                onClearAll={handleClearAll}
                onOpenFilterModal={openTagsModal}
                isFilterModalOpen={tagsModalOpen}
                onCloseFilterModal={closeTagsModal}
                filterGroups={filterGroups}
                onFilterChange={handleModalFilterChange}
                currentFilters={isMdUp === false ? tableFilters : undefined}
                tagFilterKeys={tagFilterKeys}
                selectedTags={selectedTags}
                onTagsChange={handleModalTagsChange}
              />
            )}

            {deviceTable}
          </div>
        </div>
      )}
    </div>
  );
}
