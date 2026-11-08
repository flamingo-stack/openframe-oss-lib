'use client';

import { useEffect, useRef } from 'react';
import { useEndpointsRuntime } from '../../../contexts/endpoints-runtime-context';
import { useApiParams } from '../../../hooks/state/use-api-params';
import { useSelfFetch } from '../../../hooks/use-self-fetch';
import {
  BLOCKED_SENDERS_API_PATH,
  BLOCKED_SENDERS_TAB_LABELS,
  BLOCKED_SENDERS_TABS,
  type BlockedSendersOverview,
  type BlockedSendersTab,
  blockedSendersUrl,
} from '../../../types/blocked-senders';
import { cn } from '../../../utils/cn';
import { type TabItem, TabNavigation } from '../../ui/tab-navigation';
import { BlockedSenderListTab } from './blocked-sender-list-tab';
import { BlockedSubmissionsTab } from './blocked-submissions-tab';
import { SenderSuggestionsTab } from './sender-suggestions-tab';

const DEFAULT_TAB: BlockedSendersTab = 'domains';

/** The page's address state: the open tab, its search and its page. A tab change starts its list from the top. */
const PARAM_SCHEMA = {
  tab: { type: 'string', default: DEFAULT_TAB },
  q: { type: 'string', default: '' },
  page: { type: 'number', default: 1 },
} as const;

const isTab = (value: string): value is BlockedSendersTab =>
  (BLOCKED_SENDERS_TABS as readonly string[]).includes(value);

export interface BlockedSendersPageProps {
  /**
   * Base of the host's blocked-senders routes. Default: the runtime's `blockedSendersUrl`, else
   * `BLOCKED_SENDERS_API_PATH`. A query on it (`?env=qa`) is kept on every request.
   */
  endpoint?: string;
  /**
   * The host changed a list itself (its Block modal): every change of this key reads the open list and the tab
   * counts again. The page has no block form of its own; the host's header action opens one.
   */
  refreshKey?: number;
}

/**
 * The blocklist screen, built once for any host: block and release domains and email addresses (always with a
 * reason), act on the spam recommender's suggestions, and see the submissions the gate stopped. Draws no page header:
 * the host draws its own above it. Every list is read live from the host on each load and after each change.
 */
export function BlockedSendersPage({ endpoint: endpointProp, refreshKey = 0 }: BlockedSendersPageProps) {
  const runtimeUrl = useEndpointsRuntime()?.blockedSendersUrl;
  const endpoint = endpointProp ?? runtimeUrl ?? BLOCKED_SENDERS_API_PATH;
  const { params, setParams } = useApiParams(PARAM_SCHEMA);
  const overviewUrl = blockedSendersUrl(endpoint, 'overview');
  const overview = useSelfFetch<BlockedSendersOverview>(overviewUrl);
  const summary = overview.dataUrl === overviewUrl ? overview.data : null;
  // The host's key re-reads the list; a ref keeps the effect keyed on the key alone.
  const reloadRef = useRef(overview.reload);
  useEffect(() => {
    reloadRef.current = overview.reload;
  });
  useEffect(() => {
    if (refreshKey > 0) reloadRef.current();
  }, [refreshKey]);

  const activeTab: BlockedSendersTab = isTab(params.tab) ? params.tab : DEFAULT_TAB;
  const search = params.q;
  const page = Number.isFinite(params.page) && params.page > 1 ? Math.floor(params.page) : 1;

  const tabs: TabItem[] = BLOCKED_SENDERS_TABS.map(id => {
    const count = summary?.counts[id];
    const showCount = count !== undefined && count > 0;
    return { id, label: BLOCKED_SENDERS_TAB_LABELS[id], ...(showCount ? { badge: String(count) } : {}) };
  });

  const selectTab = (tab: string) => {
    if (!isTab(tab) || tab === activeTab) return;
    setParams({ tab: tab === DEFAULT_TAB ? null : tab, q: null, page: null });
  };
  const onSearch = (next: string) => setParams({ q: next || null, page: null });
  const onPageChange = (next: number) => setParams({ page: next > 1 ? next : null });
  const onChanged = () => overview.reload();

  return (
    <div className="flex flex-col gap-[var(--spacing-system-l)]">
      <TabNavigation tabs={tabs} activeTab={activeTab} onTabChange={selectTab} staticLabels>
        {(tab, { isStale }) => (
          <div key={tab} className={cn('pt-[var(--spacing-system-m)]', isStale && 'opacity-60 transition-opacity')}>
            {tab === 'domains' || tab === 'emails' ? (
              <BlockedSenderListTab
                endpoint={endpoint}
                kind={tab === 'domains' ? 'domain' : 'address'}
                search={search}
                page={page}
                onSearch={onSearch}
                onPageChange={onPageChange}
                onChanged={onChanged}
                refreshKey={refreshKey}
              />
            ) : tab === 'suggestions' ? (
              <SenderSuggestionsTab
                endpoint={endpoint}
                search={search}
                page={page}
                bars={
                  summary
                    ? { suggest: summary.suggestBar, block: summary.blockBar, minStrong: summary.blockMinStrong }
                    : null
                }
                onSearch={onSearch}
                onPageChange={onPageChange}
                onChanged={onChanged}
              />
            ) : (
              <BlockedSubmissionsTab
                endpoint={endpoint}
                search={search}
                page={page}
                onSearch={onSearch}
                onPageChange={onPageChange}
              />
            )}
          </div>
        )}
      </TabNavigation>
    </div>
  );
}
