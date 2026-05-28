'use client';

import { useRouter } from '../embed-shims/next-navigation';
import { useCallback } from 'react';
import { OpenFrameLogo } from './icons';
import { Button } from './ui/button';

export interface FooterWaitlistButtonProps {
  className?: string;
}

/**
 * Small wrapper around JoinWaitlistButton for use inside the footer.
 *
 * Dumb-by-design — navigation only. Hash-anchor scroll behavior is
 * native: `/waitlist#top` lands at the page top via the browser's
 * built-in hash navigation + the hub's global
 * `html { scroll-behavior: smooth }` CSS rule. No JS scroll logic.
 *
 * `#top` is a magic anchor — the destination page has an explicit
 * `<div id="top">` at the top of `<main>` for browsers that don't
 * honor the HTML5 spec's "scroll to top of document for #top".
 */
export function FooterWaitlistButton({ className }: FooterWaitlistButtonProps) {
  const router = useRouter();

  const handleClick = useCallback(() => {
    router.push('/waitlist#top');
  }, [router]);

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