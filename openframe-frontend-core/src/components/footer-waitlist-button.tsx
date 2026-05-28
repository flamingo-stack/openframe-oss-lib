'use client';

import { usePathname, useRouter } from '../embed-shims/next-navigation';
import { useCallback } from 'react';
import { OpenFrameLogo } from './icons';
import { Button } from './ui/button';

export interface FooterWaitlistButtonProps {
  className?: string;
}

/**
 * Small wrapper around JoinWaitlistButton for use inside the footer.
 * Default handler smooth-scrolls to the TOP of /waitlist (showing the
 * "Introducing OpenFrame" hero) when the user is already on the page,
 * otherwise navigates to /waitlist (no hash). The form lives in-flow
 * below the hero — visible after a normal page load. The hero is the
 * marketing payload; landing the user there beats dumping them
 * mid-page on the form.
 */
export function FooterWaitlistButton({ className }: FooterWaitlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = useCallback(() => {
    if (pathname?.startsWith('/waitlist')) {
      // Same-page click — smooth-scroll back to the hero. Focus the
      // form input after the scroll completes for keyboard ergonomics.
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setTimeout(() => {
        const input = document.querySelector('#waitlist-form input[type="email"]') as HTMLInputElement | null;
        input?.focus();
      }, 600);
      return;
    }
    // Cross-page nav without the legacy `#waitlist-form` hash —
    // page's own useEffect pins scroll to top, hero renders first.
    router.push('/waitlist');
  }, [pathname, router]);

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