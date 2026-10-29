'use client';

/**
 * Shared link-attribute resolver for every entity card.
 *
 * Pure-presentation cards (BlogCard, OnboardingGuideCard, etc.)
 * historically required callers to pre-compute `target`/`rel` via a
 * `useNavLinkViaRuntime` because the same-tab-vs-new-tab
 * decision depends on `currentPlatform()` and the cross-platform
 * URL topology — neither of which the lib knows.
 *
 * This hook moves that decision INTO the card via the
 * `ChatRuntime.navigation.decideNewTab` callback already wired by
 * `HubRuntimeProvider` (and overridable per-embedder). The wrapping
 * `*-card-item.tsx` files in the hub become unnecessary — every card
 * derives its own `target`/`rel` from runtime.
 *
 * Backwards compat: explicit `target` / `rel` props always WIN over
 * runtime-derived values. Chat dispatcher callsites that already pass
 * pre-resolved attributes are unaffected.
 *
 * No runtime mounted? Returns `{ target: undefined, rel: undefined }`
 * (same-tab) — matches the documented embed-shim fallback.
 */

import { useMemo } from 'react';
import { useChatRuntime } from '../../../contexts/chat-runtime-context';
import { navLinkTarget, newTabAnchorAttrs } from '../utils/nav-anchor-props';
import { type NewTabRel, newTabRel } from '../utils/new-tab-rel';

export interface UseEntityCardLinkArgs {
  href: string;
  targetPlatform?: string | null;
  /** Explicit override. When set, runtime decision is skipped. */
  target?: '_blank';
  /** Explicit override. When set, runtime decision is skipped. */
  rel?: NewTabRel;
}

export interface EntityCardLinkProps {
  target: '_blank' | undefined;
  rel: NewTabRel | undefined;
}

export function useEntityCardLink({ href, targetPlatform, target, rel }: UseEntityCardLinkArgs): EntityCardLinkProps {
  const runtime = useChatRuntime();
  return useMemo(() => {
    // Explicit prop wins — preserves the chat-dispatcher path that
    // pre-computes attrs from `computeIsNewTab`. When `target='_blank'`
    // is passed without `rel`, auto-pair with `noopener noreferrer`
    // to close the tabnabbing vector (window.opener access from the
    // new tab back to the parent).
    if (target !== undefined || rel !== undefined) {
      const safeRel = rel ?? (target === '_blank' ? newTabRel(href, targetPlatform) : undefined);
      return { target, rel: safeRel };
    }
    // THE navigation decision (`navLinkTarget`), the one the click handler executes by, so the rendered anchor's
    // target/rel always agrees with the click; `rel` is the one referrer rule.
    const resolved = navLinkTarget(runtime, href, targetPlatform);
    const attrs = newTabAnchorAttrs(resolved.isNewTab, resolved.href, targetPlatform);
    return { target: attrs.target, rel: attrs.rel };
  }, [target, rel, href, targetPlatform, runtime]);
}
