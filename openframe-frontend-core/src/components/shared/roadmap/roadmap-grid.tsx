'use client';

/**
 * RoadmapGrid — full-page roadmap surface.
 *
 * Renders a responsive 2-col grid of `<RoadmapCard>`s (lib's chat-entity
 * card, default density), threads voting state through `useRoadmapVoting`,
 * and follows up a successful vote with a single-task refresh fetch so
 * the displayed counts stay live.
 *
 * Endpoint configuration — `buildRefreshUrl`:
 *   The single-task refresh hits a PATH-based endpoint
 *   (`/api/roadmap/<taskId>` by default). A string-concat `refreshEndpoint`
 *   would silently break embedders whose by-id route is shaped
 *   differently (e.g. `/api/roadmap?id=…`), so this prop is a function
 *   builder. The default matches the hub's pre-migration shape.
 *
 * Empty state — uses lib's `<EmptyState>` directly (identical API to
 * hub's, lives in `src/components/empty-state.tsx`).
 */

import { useState } from 'react';
import { RoadmapCard } from '../../chat/entity-cards/roadmap-card';
import { useRoadmapVoting, type UseRoadmapVotingOptions } from './use-roadmap-voting';
import { EmptyState } from '../../empty-state';
import type { RoadmapItem } from '../../chat/types/entities/roadmap-item';

const DEFAULT_BUILD_REFRESH_URL = (taskId: string) => `/api/roadmap/${taskId}`;

export interface RoadmapGridProps {
  items: RoadmapItem[];
  onItemUpdate?: (updatedItem: RoadmapItem) => void;
  /** Show the desktop left margin (~120px) that aligns the grid with
   *  the page hero. Default `true`. Related-content rails pass `false`. */
  showLeftMargin?: boolean;
  /** URL builder for the per-task refresh call after a successful vote.
   *  Function shape because the taskId sits in the URL path, not a
   *  query param. Default `(t) => \`/api/roadmap/${t}\``. */
  buildRefreshUrl?: (taskId: string) => string;
  /** Voting hook options (vote endpoint + storage key) — see
   *  `useRoadmapVoting`. */
  votingOptions?: UseRoadmapVotingOptions;
}

export function RoadmapGrid({
  items,
  onItemUpdate,
  showLeftMargin = true,
  buildRefreshUrl = DEFAULT_BUILD_REFRESH_URL,
  votingOptions,
}: RoadmapGridProps) {
  const { getVote, toggleVote } = useRoadmapVoting(votingOptions);
  const [votingTasks, setVotingTasks] = useState<Set<string>>(new Set());

  const handleVote = async (taskId: string, voteType: 'up' | 'down') => {
    // Prevent double-clicking
    if (votingTasks.has(taskId)) return;

    setVotingTasks(prev => new Set(prev).add(taskId));

    try {
      const result = await toggleVote(taskId, voteType);

      if (result.success) {
        // Refresh the specific task from server
        const response = await fetch(buildRefreshUrl(taskId));
        if (response.ok) {
          const data = await response.json();
          if (data.item && onItemUpdate) {
            onItemUpdate(data.item);
          }
        }
      }
    } finally {
      setVotingTasks(prev => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
    }
  };

  if (items.length === 0) {
    return (
      <EmptyState
        type="generic"
        title="No roadmap items"
        description="Check back soon for upcoming features and improvements!"
      />
    );
  }

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${showLeftMargin ? 'md:ml-[120px]' : ''}`}>
      {items.map((item) => (
        <RoadmapCard
          key={item.id}
          item={item}
          userVote={getVote(item.id)}
          onVote={(voteType) => handleVote(item.id, voteType)}
          isVoting={votingTasks.has(item.id)}
        />
      ))}
    </div>
  );
}
