'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../../utils/cn';
import { ClockHistoryIcon } from '../../icons-v2-generated/date-and-time/clock-history-icon';
import {
  type AppLayoutDrawerHandle,
  useAppLayoutDrawerContainer,
  useAppLayoutDrawerCoordination,
} from '../../navigation/app-layout-context';
import { HeaderButton } from '../../navigation/header-button';
import { OVERLAY_BACKDROP_CLASS } from '../../ui/drawer';
import { useOptionalTimeTracker } from './time-tracker-context';
import { TimeTrackerPanel } from './time-tracker-panel';
import { useTrackerClock } from './use-tracker-clock';

export interface TimeTrackerHeaderButtonProps {
  /** Dimming/disabled passthrough from the header. */
  className?: string;
  disabled?: boolean;
}

/**
 * Header affordance for the time tracker. Renders nothing unless wrapped in a
 * `<TimeTrackerProvider>`. The trigger is the standard `HeaderButton`; when a
 * session is active it also shows the live elapsed time. The popup is a Radix
 * Popover anchored under the button (not a modal/drawer). Inside AppLayout the
 * dim backdrop covers only the main content area (header and sidebar stay
 * interactive) and the popup joins the layout's panel coordination — opening
 * it closes any open in-layout drawer and vice versa. Outside AppLayout it
 * falls back to a viewport-wide backdrop.
 */
export function TimeTrackerHeaderButton({ className, disabled }: TimeTrackerHeaderButtonProps) {
  const ctx = useOptionalTimeTracker();
  const elapsedLabel = useTrackerClock({
    status: ctx?.status ?? 'ready',
    runningSince: ctx?.runningSince,
    accumulatedMs: ctx?.accumulatedMs,
  });
  const layoutContainer = useAppLayoutDrawerContainer();
  const coordination = useAppLayoutDrawerCoordination();

  const isOpen = ctx?.isOpen ?? false;
  // Latest-refs the stable handle below reads. Refreshed in an unconditional
  // effect, not the render body: `close()` is only ever invoked by the
  // coordinator in response to ANOTHER panel opening, which is always past a
  // commit, and a render attempt React discards must not be able to leave the
  // handle pointing at a `close` callback that never took effect.
  const isOpenRef = useRef(isOpen);
  const closeRef = useRef(ctx?.close);
  useEffect(() => {
    isOpenRef.current = isOpen;
    closeRef.current = ctx?.close;
  });

  // Stable handle: the same object must be registered AND passed as `self`
  // to notifyDrawerDidOpen so the coordinator can skip it when closing the
  // other panels. Built once by `useState`'s lazy initialiser; it closes over
  // the refs above, which never change identity.
  const [selfHandle] = useState<AppLayoutDrawerHandle>(() => ({
    close: () => {
      if (isOpenRef.current) closeRef.current?.();
    },
  }));

  useEffect(() => {
    if (isOpen) coordination?.notifyDrawerDidOpen(selfHandle);
  }, [isOpen, coordination, selfHandle]);

  useEffect(() => coordination?.registerDrawer(selfHandle), [coordination, selfHandle]);

  if (!ctx) return null;

  const { open, close, status } = ctx;
  const isPaused = status === 'paused';
  const isActive = status === 'tracking' || isPaused;

  return (
    <PopoverPrimitive.Root open={isOpen} onOpenChange={next => (next ? open() : close())}>
      <PopoverPrimitive.Trigger asChild>
        <HeaderButton
          aria-label="Time tracker"
          isActive={isOpen}
          disabled={disabled}
          className={cn(
            'outline-none',
            // ODS top-navigation spec (Figma 2797-5978): the active cell keeps
            // its square icon-only footprint on mobile and becomes a fixed
            // 144px cell with the live clock from md up.
            isActive &&
              'md:w-auto md:min-w-[144px] md:justify-center md:gap-[var(--spacing-system-xsf)] md:px-[var(--spacing-system-sf)]',
            className,
          )}
          icon={
            <>
              <ClockHistoryIcon
                className={cn('h-6 w-6', isPaused ? 'text-ods-text-secondary' : isActive && 'text-ods-accent')}
              />
              {isActive && (
                <span
                  className={cn(
                    'hidden !font-mono text-h5 md:inline md:text-h4',
                    isPaused ? 'text-ods-text-secondary' : 'text-ods-text-primary',
                  )}
                >
                  {elapsedLabel}
                </span>
              )}
            </>
          }
        />
      </PopoverPrimitive.Trigger>
      {/* Popovers have no built-in overlay — portal a dim backdrop behind the
          panel. Clicks land on it (outside Content), so Radix still closes the
          popover. Own Portal: Radix's Portal slots a single child. Inside
          AppLayout the backdrop portals into the main-area container (absolute,
          AppLayoutDrawer-overlay tier) so header/sidebar stay undimmed and
          interactive; standalone it dims the whole viewport. */}
      <PopoverPrimitive.Portal container={layoutContainer ?? undefined}>
        <div
          aria-hidden="true"
          data-state={isOpen ? 'open' : 'closed'}
          className={cn(
            layoutContainer ? 'absolute inset-0 z-[102]' : 'fixed inset-0 z-[1299]',
            OVERLAY_BACKDROP_CLASS,
            'data-[state=open]:animate-in data-[state=open]:fade-in-0',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        />
      </PopoverPrimitive.Portal>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="end"
          sideOffset={8}
          collisionPadding={8}
          className={cn(
            'z-[1300] w-[460px] max-w-[calc(100vw-1rem)] outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          )}
        >
          <TimeTrackerPanel {...ctx} onClose={close} />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
