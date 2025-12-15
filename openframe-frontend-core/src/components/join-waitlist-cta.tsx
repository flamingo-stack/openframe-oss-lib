"use client";

import React, { useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { OpenFrameLogo } from './openframe-logo';
import { ResponsiveIconsBlock } from './ui/responsive-icons-block-stub';
import { JoinWaitlistButton } from './join-waitlist-button';
import { cn } from "../utils/cn";

interface JoinWaitlistCTAProps {
  showBottomText?: boolean;
  /**
   * Optional custom handler to execute when the CTA button is pressed.
   * If not provided, the default join-waitlist navigation/focus logic will be used.
   */
  onJoin?: () => void;
  /**
   * External loading flag (used only when `onJoin` is provided). Allows parent component
   * to control the spinner state. If omitted, button is not shown as loading.
   */
  loading?: boolean;
  /** Optional extra Tailwind classes for the outer wrapper so pages can control padding / margins */
  className?: string;
}

const JoinWaitlistCTA: React.FC<JoinWaitlistCTAProps> = ({ showBottomText = true, onJoin, loading, className }) => {
  const router = useRouter();
  const pathname = usePathname();

  const defaultHandler = useCallback(() => {
    // If already on the waitlist page, smooth-scroll to the form anchor
    if (pathname?.startsWith('/waitlist')) {
      const anchor = document.getElementById('waitlist-form');
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
        setTimeout(() => {
          const input = anchor.querySelector('input[type="email"]') as HTMLInputElement | null;
          input?.focus();
        }, 400);
        return;
      }
    }

    // Otherwise navigate to the anchor; default Next.js behaviour will jump to it.
    router.push('/waitlist#waitlist-form');
  }, [pathname, router]);

  const handler = onJoin ?? defaultHandler;
  const isLoading = !!loading;

  return (
    <section className={cn("bg-[#161616] w-full max-w-[1920px] mx-auto pb-10 px-6 md:px-20 ", className)}>
      <div className="space-y-10">
      <div className="border border-[#424242] rounded-3xl w-full overflow-hidden">
        {/* Top Section: CTA */}
        <div
            className="flex flex-col items-center gap-10 p-8 text-center border-b border-[#424242]"
          style={{
            background: 'radial-gradient(circle, #242323 0%, #1A1A1A 100%)'
          }}
        >

          {/* OpenFrame logo icon + wordmark */}
          <div className="flex items-center justify-center gap-2 sm:gap-3">
            <OpenFrameLogo className="w-auto h-6 sm:h-8 md:h-12 lg:h-16 xl:h-20" lowerPathColor="#FFC008" upperPathColor="#ffffff" />
            <span className="font-['DM_Sans'] text-3xl sm:text-4xl lg:text-5xl xl:text-[56px] font-bold leading-[1.1] text-[#FFFFFF] tracking-[-0.02em]">
              OpenFrame
            </span>
          </div>


          <div className="flex flex-col items-center gap-6 text-center">
            <h2 className="font-['Azeret_Mono'] text-5xl md:text-[56px] font-semibold text-white leading-[1.14em] tracking-[-0.02em]">
              Join the Waitlist
            </h2>
            <p className="font-['DM_Sans'] text-lg font-medium text-white leading-[1.33em] max-w-[560px]">
              OpenFrame launches in Q4 2025. Be among the first MSPs to experience the future of unified, open-source operations.
            </p>
          </div>

          <JoinWaitlistButton
            onClick={handler}
            loading={isLoading}
            className="px-4 py-3 text-lg"
          >
            Join Waitlist
          </JoinWaitlistButton>
        </div>

          {/* Bottom Section: Icon Grid */}
        <div className="bg-[#1A1A1A] relative overflow-hidden">
          <ResponsiveIconsBlock />
        </div>
      </div>

      {showBottomText && (
          <h3 className="font-['Azeret_Mono'] text-center text-[32px] font-semibold text-ods-text-primary leading-[1.25em] tracking-[-0.02em]">
          The future of MSP operations is open source. Get early access.
        </h3>
      )}
    </div>
    </section>
  );
};

export default JoinWaitlistCTA;