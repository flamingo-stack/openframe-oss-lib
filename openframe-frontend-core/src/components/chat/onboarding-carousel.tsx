'use client';

import { type CSSProperties, type KeyboardEvent, type ReactNode, useState } from 'react';
import { cn } from '../../utils/cn';
import { Button } from '../ui/button';

export interface OnboardingCarouselStep {
  id: string;
  /** Glyph in the 64px tile above the title. Pass it sized to 28px. */
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
}

export interface OnboardingCarouselProps {
  steps: OnboardingCarouselStep[];
  /** The last step's primary action. */
  onComplete: () => void;
  /** Label of the last step's primary action. */
  completeLabel?: string;
  previousLabel?: string;
  nextLabel?: string;
  /** Accessible name of the carousel region. */
  label?: string;
  className?: string;
}

/**
 * Step-by-step introduction: one card at a time in the middle, its neighbours
 * peeking in from the sides under an edge fade, dots below, Previous / Next
 * underneath. The last step swaps Next for `completeLabel`. There is no skip:
 * the design walks every step.
 */
export function OnboardingCarousel({
  steps,
  onComplete,
  completeLabel = 'Start Chat',
  previousLabel = 'Previous Step',
  nextLabel = 'Next Step',
  label = 'Introduction',
  className,
}: OnboardingCarouselProps) {
  const [index, setIndex] = useState(0);
  const lastIndex = steps.length - 1;
  const isFirst = index === 0;
  const isLast = index === lastIndex;

  const goTo = (next: number) => setIndex(Math.min(Math.max(next, 0), lastIndex));

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'ArrowRight') goTo(index + 1);
    else if (event.key === 'ArrowLeft') goTo(index - 1);
    else return;
    event.preventDefault();
  };

  // Card width and the gap between cards drive both the card size and the
  // track offset, so they live in one place. Percentages resolve against the
  // viewport width in both uses (the track is as wide as the viewport).
  const trackStyle = {
    '--onboarding-card-w': 'min(600px, calc(100% - 2 * var(--spacing-system-xl)))',
    '--onboarding-gap': 'var(--spacing-system-lf)',
    transform: `translateX(calc(${-index} * (var(--onboarding-card-w) + var(--onboarding-gap))))`,
  } as CSSProperties;

  return (
    <section
      aria-roledescription="carousel"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn('flex w-full flex-col items-center gap-[var(--spacing-system-xl)]', className)}
    >
      <div className="flex w-full flex-col items-center gap-[var(--spacing-system-xs)]">
        <div className="relative w-full overflow-hidden">
          <div
            aria-live="polite"
            className="flex w-full gap-[var(--onboarding-gap)] transition-transform duration-300 ease-out motion-reduce:transition-none"
            style={trackStyle}
          >
            {steps.map((step, i) => {
              const isCurrent = i === index;
              return (
                <div
                  key={step.id}
                  role="group"
                  aria-roledescription="slide"
                  aria-label={`${i + 1} of ${steps.length}`}
                  aria-hidden={!isCurrent}
                  inert={!isCurrent || undefined}
                  className={cn(
                    'flex w-[var(--onboarding-card-w)] shrink-0 flex-col items-center justify-center gap-[var(--spacing-system-m)] rounded-md border border-ods-border bg-ods-card px-[var(--spacing-system-xl)] py-[var(--spacing-system-xxl)] text-center',
                    i === 0 && 'ml-[calc((100%-var(--onboarding-card-w))/2)]',
                  )}
                >
                  <span className="flex size-16 shrink-0 items-center justify-center rounded-md border border-ods-border bg-ods-bg text-ods-accent">
                    {step.icon}
                  </span>
                  <div className="flex flex-col gap-[var(--spacing-system-l)] text-ods-text-primary [word-break:break-word]">
                    <h2 className="text-h2">{step.title}</h2>
                    {step.description && <p className="whitespace-pre-line text-h6">{step.description}</p>}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-[120px] bg-gradient-to-r from-ods-bg to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-[120px] bg-gradient-to-l from-ods-bg to-transparent" />
        </div>

        <div className="flex items-center" role="group" aria-label="Choose step">
          {steps.map((step, i) => {
            const isCurrent = i === index;
            return (
              <Button
                key={step.id}
                variant="transparent"
                aria-current={isCurrent ? 'step' : undefined}
                aria-label={`Go to step ${i + 1}`}
                onClick={() => goTo(i)}
                className="flex size-6 shrink-0 items-center justify-center rounded-full p-0 md:h-6"
              >
                <span
                  className={cn(
                    'size-1.5 rounded-full transition-colors duration-150',
                    isCurrent ? 'bg-ods-accent' : 'bg-ods-text-secondary',
                  )}
                />
              </Button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-[var(--spacing-system-m)]">
        <Button variant="outline" className="w-[200px]" disabled={isFirst} onClick={() => goTo(index - 1)}>
          {previousLabel}
        </Button>
        <Button variant="accent" className="w-[200px]" onClick={isLast ? onComplete : () => goTo(index + 1)}>
          {isLast ? completeLabel : nextLabel}
        </Button>
      </div>
    </section>
  );
}
