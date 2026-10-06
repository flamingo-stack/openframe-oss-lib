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
  LOGS_FIXTURE_SELECTED,
  LOGS_FIXTURE_SELECTED_DETAILS,
} from '../fixtures/logs';
import type { ProductScreenViewProps } from '../types';

const noop = () => {};
const NO_FILTERS: Record<string, string[]> = {};
/** The narrow rendering keeps what a row is about and drops its action buttons. */
const COMPACT_HIDDEN: LogsTableColumnId[] = ['copy', 'quickView', 'open'];
const logHref = () => '#';
const copyAction = () => <LogCopyIconButton />;

/** The product's Logs page with one entry open in the Log Details drawer; the narrow rendering is the table alone. */
export default function LogsScreen({ compact = false }: ProductScreenViewProps) {
  // The drawer portals into this box, so it stays inside the screen, docked beside the table.
  const [dock, setDock] = useState<HTMLDivElement | null>(null);
  const selected = LOGS_FIXTURE_SELECTED;

  return (
    <div className="flex h-full bg-ods-bg">
      <div className="min-w-0 flex-1 overflow-hidden px-[var(--spacing-system-l)] pb-[var(--spacing-system-l)]">
        <LogsPageView onRefresh={noop} search="" onSearchChange={noop} onOpenFilters={noop}>
          <LogsTableView
            logs={LOGS_FIXTURE_ENTRIES}
            facets={LOGS_FIXTURE_FACETS}
            filters={NO_FILTERS}
            onFilterChange={noop}
            getLogHref={logHref}
            renderCopyAction={copyAction}
            onQuickView={noop}
            hiddenColumns={compact ? COMPACT_HIDDEN : undefined}
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
