'use client';

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
import { TextLineSkeleton } from '../../loading/unified-skeleton';
import { Alert } from '../../ui/alert';
import { type TabItem, TabNavigation } from '../../ui/tab-navigation';
import { BlockedSenderListTab } from './blocked-sender-list-tab';
import {
  AUTO_BLOCK_OFF_TEXT,
  AUTO_BLOCK_OFF_TITLE,
  AUTO_BLOCK_ON_TITLE,
  autoBlockOnText,
  DRY_RUN_BANNER_TEXT,
  DRY_RUN_BANNER_TITLE,
} from './blocked-senders-presentation';
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
}

/**
 * The blocklist screen, built once for any host: block and release domains and email addresses (always with a
 * reason), act on the spam recommender's suggestions, and see the submissions the gate stopped. Draws no page header:
 * the host draws its own above it. Every list is read live from the host on each load and after each change.
 */
export function BlockedSendersPage({ endpoint: endpointProp }: BlockedSendersPageProps) {
  const runtimeUrl = useEndpointsRuntime()?.blockedSendersUrl;
  const endpoint = endpointProp ?? runtimeUrl ?? BLOCKED_SENDERS_API_PATH;
  const { params, setParams } = useApiParams(PARAM_SCHEMA);
  const overviewUrl = blockedSendersUrl(endpoint, 'overview');
  const overview = useSelfFetch<BlockedSendersOverview>(overviewUrl);
  const summary = overview.dataUrl === overviewUrl ? overview.data : null;

  const activeTab: BlockedSendersTab = isTab(params.tab) ? params.tab : DEFAULT_TAB;
  const search = params.q;
  const page = Number.isFinite(params.page) && params.page > 1 ? Math.floor(params.page) : 1;

  const tabs: TabItem[] = BLOCKED_SENDERS_TABS.map(id => {
    const count = summary?.counts[id];
    const showCount = count !== undefined && count > 0 && !(id === 'emails' && !summary?.emailsAvailable);
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
      <AutoBlockStatus summary={summary} />
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

/**
 * What auto-block is doing, always one line in the same place (so the page below never moves when the overview
 * lands): in dry run the warning, on or off a quiet note, and while the overview is read its loading form.
 */
function AutoBlockStatus({ summary }: { summary: BlockedSendersOverview | null }) {
  const lineClass = 'flex flex-wrap gap-x-[var(--spacing-system-sf)] gap-y-1';
  const quietClass = 'border-ods-border bg-ods-card text-ods-text-secondary';
  if (!summary) {
    return (
      <Alert role="note" aria-busy="true" className={cn(lineClass, quietClass)}>
        <TextLineSkeleton type="h5" className="w-2/3" />
      </Alert>
    );
  }
  const { enabled, dryRun } = summary.autoBlock;
  if (enabled && dryRun) {
    return (
      <Alert variant="warning" role="note" className={lineClass}>
        <strong className="text-h5">{DRY_RUN_BANNER_TITLE}</strong>
        <span className="text-h5">{DRY_RUN_BANNER_TEXT}</span>
      </Alert>
    );
  }
  return (
    <Alert role="note" className={cn(lineClass, quietClass)}>
      <strong className="text-ods-text-primary text-h5">{enabled ? AUTO_BLOCK_ON_TITLE : AUTO_BLOCK_OFF_TITLE}</strong>
      <span className="text-h5">
        {enabled ? autoBlockOnText(summary.blockBar, summary.blockMinStrong) : AUTO_BLOCK_OFF_TEXT}
      </span>
    </Alert>
  );
}
