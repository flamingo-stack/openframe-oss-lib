'use client';

/**
 * useRoadmapVoting — localStorage-backed optimistic voting for roadmap cards.
 *
 * One vote per task per user (storage key scoped per `storageKey` option,
 * default `'roadmap_votes_v1'`). Toggling the same vote removes it;
 * switching directions sends a remove + add pair so the server's running
 * totals stay correct.
 *
 * Endpoint configuration — `voteApiEndpoint`:
 *   The hook posts to ONE endpoint (default `/api/roadmap/vote`) for
 *   BOTH the optimistic add AND the opposite-vote remove. Reverse-proxy
 *   embedders override this with their proxied path; lib otherwise
 *   matches the hub's pre-migration call shape.
 */

import { useState, useEffect, useCallback } from 'react';
import { contentFetch } from '../../../utils/embed-content-fetch';

export type VoteType = 'up' | 'down' | null;

export interface VoteState {
  [taskId: string]: VoteType;
}

export interface UseRoadmapVotingOptions {
  /** Vote endpoint URL. Default `/api/roadmap/vote`. */
  voteApiEndpoint?: string;
  /** localStorage key. Default `'roadmap_votes_v1'`. Embedders mounting
   *  multiple roadmap surfaces in the same origin can scope per-surface
   *  (e.g. `'roadmap_votes_v1_main'` vs `'roadmap_votes_v1_admin'`) so
   *  votes don't cross-contaminate. */
  storageKey?: string;
}

const DEFAULT_VOTE_ENDPOINT = '/api/roadmap/vote';
const DEFAULT_STORAGE_KEY = 'roadmap_votes_v1';

export function useRoadmapVoting(options: UseRoadmapVotingOptions = {}) {
  const voteApiEndpoint = options.voteApiEndpoint ?? DEFAULT_VOTE_ENDPOINT;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  const [votes, setVotes] = useState<VoteState>({});
  const [isLoading, setIsLoading] = useState(true);

  // Load votes from localStorage. Runs on mount AND whenever `storageKey`
  // changes — when the key changes mid-lifecycle (e.g. an embedder
  // remounts with a new namespace), we MUST reset state first so the
  // save-effect below doesn't write the old key's data into the new
  // key. We also re-enter the loading phase so the load completes
  // before any save runs.
  useEffect(() => {
    setIsLoading(true);
    setVotes({});
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setVotes(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[Voting] Error loading votes from localStorage:', error);
    } finally {
      setIsLoading(false);
    }
  }, [storageKey]);

  // Save votes to localStorage whenever they change
  useEffect(() => {
    if (!isLoading) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(votes));
      } catch (error) {
        console.error('[Voting] Error saving votes to localStorage:', error);
      }
    }
  }, [votes, isLoading, storageKey]);

  const getVote = useCallback(
    (taskId: string): VoteType => {
      return votes[taskId] || null;
    },
    [votes]
  );

  const toggleVote = useCallback(
    async (
      taskId: string,
      voteType: 'up' | 'down'
    ): Promise<{ success: boolean; newVote: VoteType; action: 'add' | 'remove' }> => {
      const currentVote = votes[taskId];

      let newVote: VoteType = null;
      let action: 'add' | 'remove' = 'add';

      if (currentVote === voteType) {
        // User clicked same vote - remove it
        newVote = null;
        action = 'remove';
      } else {
        // User clicked different vote - set it. If they had an opposite
        // vote, remove that first so the server totals stay consistent.
        if (currentVote) {
          await contentFetch(voteApiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              taskId,
              voteType: currentVote,
              action: 'remove',
            }),
          }).catch(err => console.error('[Voting] Error removing opposite vote:', err));
        }

        newVote = voteType;
        action = 'add';
      }

      // Optimistic update
      setVotes(prev => ({
        ...prev,
        [taskId]: newVote,
      }));

      try {
        const response = await contentFetch(voteApiEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId, voteType, action }),
        });

        if (!response.ok) {
          throw new Error('Vote API request failed');
        }

        return { success: true, newVote, action };
      } catch (error) {
        console.error('[Voting] API error:', error);

        // Revert optimistic update on error
        setVotes(prev => ({
          ...prev,
          [taskId]: currentVote,
        }));

        return { success: false, newVote: currentVote, action };
      }
    },
    [votes, voteApiEndpoint]
  );

  const clearVotes = useCallback(() => {
    setVotes({});
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  return {
    votes,
    isLoading,
    getVote,
    toggleVote,
    clearVotes,
  };
}
