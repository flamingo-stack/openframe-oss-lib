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
import { useIsHydrated } from '../../../hooks/ui/use-is-hydrated';
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

/** One shared empty map so "no votes" is a stable identity across renders. */
const NO_VOTES: VoteState = {};

/** Client-only: callers must gate on `useIsHydrated()` before reaching here. */
function readStoredVotes(storageKey: string): VoteState {
  try {
    const stored = localStorage.getItem(storageKey);
    return stored ? (JSON.parse(stored) as VoteState) : NO_VOTES;
  } catch (error) {
    console.error('[Voting] Error loading votes from localStorage:', error);
    return NO_VOTES;
  }
}

export function useRoadmapVoting(options: UseRoadmapVotingOptions = {}) {
  const voteApiEndpoint = options.voteApiEndpoint ?? DEFAULT_VOTE_ENDPOINT;
  const storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;

  const [votes, setVotes] = useState<VoteState>(NO_VOTES);
  // Which key `votes` was loaded from. `null` until the client has read
  // storage — that IS the loading flag, so nothing has to be written into a
  // separate `isLoading` state.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);

  // Load votes from localStorage. Happens on the first render after hydration,
  // AND whenever `storageKey` changes — when the key changes mid-lifecycle
  // (e.g. an embedder remounts with a new namespace) the previous key's votes
  // MUST NOT survive, or the save below writes the old key's data into the new
  // key. Re-entering the loading phase is implicit: `loadedKey` stops matching,
  // so `isLoading` is true again until this reload lands.
  //
  // Read and applied while rendering, not from an effect. `localStorage` cannot
  // be touched during SSR or the hydration render, which is what `useIsHydrated`
  // gates; past that point `getItem` is just a read, and doing it here means the
  // stored votes are present in the FIRST render that can show them instead of
  // being published by a second render pass.
  const hydrated = useIsHydrated();
  if (hydrated && loadedKey !== storageKey) {
    setLoadedKey(storageKey);
    setVotes(readStoredVotes(storageKey));
  }
  const isLoading = loadedKey !== storageKey;

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
    [votes],
  );

  const toggleVote = useCallback(
    async (
      taskId: string,
      voteType: 'up' | 'down',
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
          }).catch((err: unknown) => console.error('[Voting] Error removing opposite vote:', err));
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
    [votes, voteApiEndpoint],
  );

  const clearVotes = useCallback(() => {
    setVotes(NO_VOTES);
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
