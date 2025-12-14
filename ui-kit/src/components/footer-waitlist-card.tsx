'use client';

import React, { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { JoinWaitlistButton } from './join-waitlist-button';

export function FooterWaitlistCard() {
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
    <div className="bg-[#424242] rounded-lg p-4 md:p-6 w-full flex flex-col gap-4">
      <h3 className="font-['DM_Sans'] text-lg font-semibold text-ods-text-primary text-bold leading-tight text-left">
        OpenFrame – Coming Soon
      </h3>
      <p className="text-sm text-left">
        Reduce costs and increase revenue with OpenFrame innovative open source solutions. Coming soon…
      </p>
      <JoinWaitlistButton onClick={handleClick} className="w-full" lowerPathColor="#FFC008" upperPathColor="#ffffff" buttonBackgroundColor="#1A1A1A" buttonTextColor="#FAFAFA" />
    </div>
  );
} 