'use client';

import { useState } from 'react';
import { normalizeToolTypeWithFallback } from '../../../utils/tool-utils';
import {
  LogCopyIconButton,
  LogDrawer,
  logSourceLabels,
  LogsPageView,
  type LogsTableColumnId,
  LogsTableView,
} from '../../features/logs';
import { AppLayoutDrawerContainerContext } from '../../navigation/app-layout-context';
import { ToolBadge } from '../../platform/ToolBadge';
import { Button } from '../../ui/button';
import { DeviceCard } from '../../ui/device-card';
import {
  LOGS_FIXTURE_DEVICE,
  LOGS_FIXTURE_ENTRIES,
  LOGS_FIXTURE_FACETS,
  LOGS_FIXTURE_SEARCH,
  LOGS_FIXTURE_SELECTED,
  LOGS_FIXTURE_SELECTED_DETAILS,
} from '../fixtures/logs';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};
const NO_FILTERS: Record<string, string[]> = {};
/** A row's action buttons carry nothing in a picture and squeeze what the row is about: both renderings drop them. */
const ACTION_COLUMNS: LogsTableColumnId[] = ['copy', 'quickView', 'open'];
/**
 * Beside the open drawer the table keeps when, how bad and what happened: the
 * tool and the device are in the drawer, and their fixed widths would leave
 * the message no room.
 */
const BESIDE_DRAWER_HIDDEN: LogsTableColumnId[] = [...ACTION_COLUMNS, 'tool', 'source'];
const logHref = () => '#';
const copyAction = () => <LogCopyIconButton />;

/** The product's Logs page with one entry open in the Log Details drawer; the narrow rendering is the table alone. */
export default function LogsScreen({ compact = false }: ProductScreenViewProps) {
  // The drawer portals into this box, so it stays inside the screen, docked beside the table.
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const selected = LOGS_FIXTURE_SELECTED;

  return (
    <div className="flex h-full bg-ods-bg">
      {/* Clipped, not a scroll container: the page's sticky toolbar and table header measure from the frame, as they do from the product's page. */}
      <div className="min-w-0 flex-1 overflow-clip">
        {/* No title row: the job is named above the picture. The search shows the query the rows answer. */}
        <LogsPageView
          showHeader={false}
          className="p-[var(--spacing-system-l)]"
          search={LOGS_FIXTURE_SEARCH}
          onSearchChange={noop}
          onOpenFilters={noop}
        >
          <LogsTableView
            logs={LOGS_FIXTURE_ENTRIES}
            facets={LOGS_FIXTURE_FACETS}
            filters={NO_FILTERS}
            onFilterChange={noop}
            getLogHref={logHref}
            renderCopyAction={copyAction}
            onQuickView={noop}
            hiddenColumns={compact ? ACTION_COLUMNS : BESIDE_DRAWER_HIDDEN}
          />
        </LogsPageView>
      </div>

      {!compact && (
        <div ref={setDock} className="relative w-[calc(400px+var(--spacing-system-m))] shrink-0">
          {dock && (
            <AppLayoutDrawerContainerContext.Provider value={dock}>
              <LogDrawer
                docked
                isOpen
                onClose={noop}
                description={<div className="whitespace-pre-wrap break-words">{LOGS_FIXTURE_SELECTED_DETAILS}</div>}
                statusTag={selected.status}
                timestamp={selected.timestamp}
                infoFields={[
                  { label: 'Log ID', value: selected.logId },
                  {
                    label: 'Source',
                    value: <ToolBadge toolType={normalizeToolTypeWithFallback(selected.source.toolType)} />,
                  },
                  { label: 'Device', value: logSourceLabels(selected.device).deviceName },
                ]}
                deviceCard={
                  <DeviceCard
                    {...LOGS_FIXTURE_DEVICE}
                    actions={{
                      moreButton: { visible: false },
                      detailsButton: {
                        visible: true,
                        component: (
                          <Button variant="outline" className="shrink-0">
                            Details
                          </Button>
                        ),
                      },
                    }}
                  />
                }
              />
            </AppLayoutDrawerContainerContext.Provider>
          )}
        </div>
      )}
    </div>
  );
}
