'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useCallback } from 'react';
import { OpenFrameLogo } from './icons';
import { Button } from './ui/button';

export interface FooterWaitlistButtonProps {
  className?: string;
}

/**
 * Small wrapper around JoinWaitlistButton for use inside the footer.
 * Provides a default click handler that scrolls/focuses the wait-list form
 * if the user is already on /waitlist; otherwise navigates to it.
 */
export function FooterWaitlistButton({ className }: FooterWaitlistButtonProps) {
  const router = useRouter();
  const pathname = usePathname();

  const handleClick = useCallback(() => {
    if (pathname?.startsWith('/waitlist')) {
      const anchor = document.getElementById('waitlist-form');
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' } as any);
        setTimeout(() => {
          const input = anchor.querySelector('input[type="email"]') as HTMLInputElement | null;
          input?.focus();
        }, 400);
        return;
      }
    }
    router.push('/waitlist#waitlist-form');
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