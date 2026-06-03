'use client';

import { useRouter } from '../embed-shims/next-navigation';
import { useChatRuntime } from '../contexts/chat-runtime-context';
import { executeNavigationImperative } from './chat/utils/execute-navigation';
import { useCallback } from 'react';
import { OpenFrameLogo } from './icons';
import { Button } from './ui/button';

export interface FooterWaitlistButtonProps {
  className?: string;
}

/**
 * Small wrapper around JoinWaitlistButton for use inside the footer.
 *
 * Routes through the host's unified-navigation hook
 * (`runtime.navigation.navigate`) when a `ChatRuntimeContext` is
 * mounted — that's the same path EVERY other in-app navigation
 * surface uses (source chips, inline cards, search-autocomplete,
 * action cards). One rule, one decision tree across the whole app.
 * The hub's `HubRuntimeProvider` wires `navigate` to its `useUnifiedNav`
 * helper, so this button picks up cross-platform new-tab decisions,
 * same-URL re-scroll handling, embed-mode short-circuiting, and any
 * future host-side nav rules for free.
 *
 * Falls back to the embed-shim's `router.push` when no runtime is
 * mounted (third-party embedders who haven't set up
 * `ChatRuntimeContext` — the lib stays usable without forcing them
 * to wire the full chat-runtime).
 *
 * Target URL: `/waitlist#top`. `#top` is the canonical "scroll to
 * page top" anchor — the destination page has an explicit
 * `<div id="top">` at the top of `<main>` so native browser anchor
 * scroll works in every browser regardless of the HTML5 magic-anchor
 * behavior.
 */
export function FooterWaitlistButton({ className }: FooterWaitlistButtonProps) {
  const router = useRouter();
  const runtime = useChatRuntime();

  const handleClick = useCallback(() => {
    // The unified nav primitive: host `navigation.navigate` if wired, else the
    // embed-shim router; new-tab/embed decision handled internally.
    executeNavigationImperative({ runtime, href: '/waitlist#top', fallbackNavigate: router.push });
  }, [router, runtime]);

  return (
    <Button 
      onClick={handleClick} 
      className={className}
      leftIcon={<OpenFrameLogo />}
    >
      Join Waitlist
    </Button>
  );
} 