'use client';

/**
 * RoadmapGrid — the shared roadmap LIST surface.
 *
 * Two modes (one component, one voting state):
 *   - `groupByQuarter` (DEFAULT): buckets items by `item.quarter`, sorts the
 *     quarters chronologically, and renders each in a collapsible `<Accordion>`
 *     — the same quarter grouping the hub's roadmap page has, now shared so
 *     every embedder gets it for free. Quarters at/after the current quarter
 *     (and within `quartersToKeepClosed` of it) open by default; older ones
 *     collapse. When `hasActiveFilters`, all quarters expand.
 *   - `groupByQuarter={false}`: a flat 2-col grid (related-content rails that
 *     pass a small pre-filtered `items` slice).
 *
 * Voting state (`useRoadmapVoting` + the in-flight set) lives ONCE at this
 * level and is shared across every quarter's grid, so a vote in Q3 and a vote
 * in Q4 can't race separate states. A successful vote triggers a single-task
 * refresh (`buildRefreshUrl`) and patches the parent list via `onItemUpdate`.
 *
 * Hydration: `expandedQuarters` starts `[]` and is populated in a client-only
 * effect (mirrors the hub) so SSR markup matches first client paint.
 */

import { useEffect, useRef, useState } from 'react';
import { RoadmapCard } from '../../chat/entity-cards/roadmap-card';
import { useRoadmapVoting, type UseRoadmapVotingOptions } from './use-roadmap-voting';
import { EmptyState } from '../../empty-state';
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '../../ui';
import { cn } from '../../../utils/cn';
import type { RoadmapItem } from '../../chat/types/entities/roadmap-item';

const DEFAULT_BUILD_REFRESH_URL = (taskId: string) => `/api/roadmap/${taskId}`;
const BACKLOG = 'Backlog';

// ── Quarter helpers (pure; lifted from the hub roadmap section) ──────────────

/** Status → sort priority (Complete → Working → Review → To-Do → other). */
function getStatusPriority(status: string): number {
  const s = (status || '').toLowerCase();
  if (s.includes('complete') || s.includes('done')) return 1;
  if (s.includes('working') || s.includes('progress')) return 2;
  if (s.includes('review')) return 3;
  if (s.includes('to do') || s.includes('plan')) return 4;
  return 5;
}

/** Parse a `"Q<n> <year>"` label → {quarter, year}; `null` when unparseable. */
function parseQuarterString(q: string): { quarter: number; year: number } | null {
  const match = q.match(/Q(\d+)\s+(\d+)/);
  if (!match) return null;
  return { quarter: parseInt(match[1], 10), year: parseInt(match[2], 10) };
}

function compareQuarters(
  a: { quarter: number; year: number },
  b: { quarter: number; year: number },
): number {
  if (a.year !== b.year) return a.year - b.year;
  return a.quarter - b.quarter;
}

/** Today's quarter — client-only (called from an effect, never during SSR). */
function getCurrentQuarter(): { quarter: number; year: number } {
  const now = new Date();
  return { quarter: Math.floor(now.getMonth() / 3) + 1, year: now.getFullYear() };
}

/** Quarters open by default: current + future, plus the recent past within
 *  `quartersToKeepClosed` of the current quarter; Backlog always open. */
function computeDefaultExpandedQuarters(quarters: string[], quartersToKeepClosed: number): string[] {
  const currentQ = getCurrentQuarter();
  const out: string[] = [];
  for (const q of quarters) {
    if (q === BACKLOG) continue;
    const parsed = parseQuarterString(q);
    if (!parsed) continue;
    const diff = compareQuarters(parsed, currentQ);
    if (diff >= 0) {
      out.push(q);
    } else {
      const quartersAgo = currentQ.year * 4 + currentQ.quarter - (parsed.year * 4 + parsed.quarter);
      if (quartersAgo < quartersToKeepClosed) out.push(q);
    }
  }
  if (quarters.includes(BACKLOG)) out.push(BACKLOG);
  return out;
}

export interface RoadmapGridProps {
  items: RoadmapItem[];
  onItemUpdate?: (updatedItem: RoadmapItem) => void;
  /** Show the desktop left margin (~120px) that aligns the grid with the page
   *  hero. Default `true`. Related-content rails pass `false`. */
  showLeftMargin?: boolean;
  /** URL builder for the per-task refresh call after a successful vote. */
  buildRefreshUrl?: (taskId: string) => string;
  /** Voting hook options (vote endpoint + storage key). */
  votingOptions?: UseRoadmapVotingOptions;
  /** Group items into collapsible per-quarter accordions. Default `false`
   *  (flat grid) so EXISTING callers — the hub's per-quarter RoadmapGrid calls
   *  and related-content rails — stay unchanged. `RoadmapView` / full-page
   *  callers pass `true` to get the shared quarter grouping. */
  groupByQuarter?: boolean;
  /** When true (search/filter active), every quarter expands so results aren't
   *  hidden in collapsed sections. Threaded from `RoadmapView`. */
  hasActiveFilters?: boolean;
  /** Past quarters within this window of the current quarter stay open by
   *  default; older ones collapse. Default `2`. */
  quartersToKeepClosed?: number;
}

/** Internal flat 2-col grid for ONE set of items. Voting comes from the parent
 *  so the state is shared across quarters. */
function RoadmapGridSingle({
  items,
  showLeftMargin,
  getVote,
  onVote,
  votingTasks,
}: {
  items: RoadmapItem[];
  showLeftMargin: boolean;
  getVote: (taskId: string) => 'up' | 'down' | null;
  onVote: (taskId: string, voteType: 'up' | 'down') => void;
  votingTasks: Set<string>;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${showLeftMargin ? 'md:ml-[120px]' : ''}`}>
      {items.map((item) => (
        <RoadmapCard
          key={item.id}
          item={item}
          userVote={getVote(item.id)}
          onVote={(voteType) => onVote(item.id, voteType)}
          isVoting={votingTasks.has(item.id)}
        />
      ))}
    </div>
  );
}

export function RoadmapGrid({
  items,
  onItemUpdate,
  showLeftMargin = true,
  buildRefreshUrl = DEFAULT_BUILD_REFRESH_URL,
  votingOptions,
  groupByQuarter = false,
  hasActiveFilters = false,
  quartersToKeepClosed = 2,
}: RoadmapGridProps) {
  // ── Voting (shared across all quarters) ──
  const { getVote, toggleVote } = useRoadmapVoting(votingOptions);
  const [votingTasks, setVotingTasks] = useState<Set<string>>(new Set());

  const handleVote = async (taskId: string, voteType: 'up' | 'down') => {
    if (votingTasks.has(taskId)) return;
    setVotingTasks((prev) => new Set(prev).add(taskId));
    try {
      const result = await toggleVote(taskId, voteType);
      if (result.success) {
        const response = await fetch(buildRefreshUrl(taskId));
        if (response.ok) {
          const data = await response.json();
          if (data.item && onItemUpdate) onItemUpdate(data.item);
        }
      }
    } finally {
      setVotingTasks((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  // ── Quarter bucketing + chronological sort (recomputed each render; cheap) ──
  const itemsByQuarter = items.reduce<Record<string, RoadmapItem[]>>((acc, item) => {
    const q = item.quarter || BACKLOG;
    (acc[q] ||= []).push(item);
    return acc;
  }, {});
  for (const q of Object.keys(itemsByQuarter)) {
    itemsByQuarter[q].sort((a, b) => getStatusPriority(a.status) - getStatusPriority(b.status));
  }
  const sortedQuarters = Object.keys(itemsByQuarter).sort((a, b) => {
    if (a === BACKLOG) return 1;
    if (b === BACKLOG) return -1;
    const aD = parseQuarterString(a) ?? { quarter: 0, year: 0 };
    const bD = parseQuarterString(b) ?? { quarter: 0, year: 0 };
    return compareQuarters(aD, bD);
  });
  const sortedQuartersKey = sortedQuarters.join(',');

  // ── Accordion expand state (hydration-safe: start [], populate in effects) ──
  const [expandedQuarters, setExpandedQuarters] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const hasSetInitialState = useRef(false);
  const prevItemsLength = useRef(0);

  // Initial expand state once data loads (runs once, or when data first arrives).
  useEffect(() => {
    const itemsJustLoaded = prevItemsLength.current === 0 && items.length > 0;
    prevItemsLength.current = items.length;
    if (sortedQuarters.length > 0 && (!hasSetInitialState.current || itemsJustLoaded)) {
      hasSetInitialState.current = true;
      setExpandedQuarters(
        hasActiveFilters
          ? [...sortedQuarters]
          : computeDefaultExpandedQuarters(sortedQuarters, quartersToKeepClosed),
      );
      setIsInitialized(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedQuarters.length, items.length]);

  // React to filter toggles AFTER init: filters on → expand all; off → defaults.
  useEffect(() => {
    if (!isInitialized || sortedQuarters.length === 0) return;
    setExpandedQuarters(
      hasActiveFilters
        ? [...sortedQuarters]
        : computeDefaultExpandedQuarters(sortedQuarters, quartersToKeepClosed),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasActiveFilters, sortedQuartersKey, isInitialized, quartersToKeepClosed]);

  if (items.length === 0) {
    return (
      <EmptyState
        type="generic"
        title="No roadmap items"
        description="Check back soon for upcoming features and improvements!"
      />
    );
  }

  // Flat mode (related-content rails) — no accordion.
  if (!groupByQuarter) {
    return (
      <RoadmapGridSingle
        items={items}
        showLeftMargin={showLeftMargin}
        getVote={getVote}
        onVote={handleVote}
        votingTasks={votingTasks}
      />
    );
  }

  return (
    <Accordion
      type="multiple"
      value={expandedQuarters}
      onValueChange={setExpandedQuarters}
      className="flex flex-col gap-10"
    >
      {sortedQuarters.map((quarter) => {
        const itemCount = itemsByQuarter[quarter]?.length || 0;
        const isExpanded = expandedQuarters.includes(quarter);
        return (
          <AccordionItem
            key={quarter}
            value={quarter}
            id={`quarter-${quarter.replace(/\s+/g, '-').toLowerCase()}`}
            className="border-0"
          >
            <AccordionTrigger className="w-full p-0 hover:no-underline [&>svg]:h-5 [&>svg]:w-5 [&>svg]:text-ods-text-secondary [&>svg]:ml-auto [&>svg]:shrink-0">
              <div className="flex items-center gap-3">
                <h3
                  className={cn(
                    "font-['Azeret_Mono'] font-semibold text-[24px] md:text-[28px] lg:text-[32px] leading-[32px] md:leading-[36px] lg:leading-[40px] text-ods-text-primary tracking-[-0.48px] md:tracking-[-0.56px] lg:tracking-[-0.64px] transition-opacity",
                    isExpanded ? 'opacity-100' : 'opacity-60',
                  )}
                >
                  {quarter}
                  <span className="text-ods-accent">:</span>
                </h3>
                <span
                  className={cn(
                    'text-sm font-medium transition-opacity',
                    isExpanded ? 'text-ods-text-secondary opacity-100' : 'text-ods-text-tertiary opacity-60',
                  )}
                >
                  {itemCount} {itemCount === 1 ? 'item' : 'items'}
                  {isInitialized && !isExpanded && <span className="ml-2 text-ods-accent">Click to expand</span>}
                </span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-0 overflow-hidden data-[state=closed]:animate-none data-[state=open]:animate-none">
              <RoadmapGridSingle
                items={itemsByQuarter[quarter]}
                showLeftMargin={showLeftMargin}
                getVote={getVote}
                onVote={handleVote}
                votingTasks={votingTasks}
              />
            </AccordionContent>
          </AccordionItem>
        );
      })}
    </Accordion>
  );
}
