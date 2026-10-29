'use client';

import { cn } from '../../../utils/cn';
import { OpenframeLogoIcon } from '../../icons-v2-generated/logos/openframe-logo-icon';
import { BenefitList, trialBenefits, type BenefitItem } from '../../ui/benefit-list';
import { Button } from '../../ui/button';

/** One benefit of the panel: the lib's benefit item. */
export type AuthBenefit = BenefitItem;

export interface AuthBenefitsPanelProps {
  title?: string;
  description?: string;
  benefits?: AuthBenefit[];
  /** The free trial's length in days, as the host read it from the billing plan. Without it the length is not stated. */
  trialDays?: number | null;
  learnMoreLabel?: string;
  learnMoreUrl?: string;
  className?: string;
}

const DEFAULT_TITLE = 'The All-in-One Open Platform for MSPs';

const DEFAULT_DESCRIPTION =
  'All your core ops in one place - built for MSPs who are done duct-taping tools together. Unified stack, AI-ready, no vendor tax. Just solid software that lets you run lean and fast.';

/**
 * Marketing panel shown alongside the auth forms — title, blurb, benefit chips
 * and a "learn more" link. Presentational; content is overridable via props.
 */
export function AuthBenefitsPanel({
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  trialDays,
  benefits = trialBenefits(trialDays),
  learnMoreLabel = 'Learn More About OpenFrame',
  learnMoreUrl = 'https://www.flamingo.run/',
  className,
}: AuthBenefitsPanelProps) {
  return (
    <div
      className={cn(
        'flex w-full flex-col gap-[var(--spacing-system-xl)] rounded-md border border-ods-border bg-ods-bg p-[var(--spacing-system-xl)]',
        className,
      )}
    >
      <h2 className="tracking-[-0.64px] text-ods-text-primary text-h2">{title}</h2>
      <p className="text-ods-text-primary text-h4">{description}</p>

      <BenefitList items={benefits} />

      <Button
        variant="outline"
        href={learnMoreUrl}
        openInNewTab
        leftIcon={
          <OpenframeLogoIcon
            secondaryColor="var(--color-accent-primary)"
            className="h-6 w-6"
            color="var(--color-text-primary)"
          />
        }
        className="w-full md:w-auto md:self-start"
      >
        {learnMoreLabel}
      </Button>
    </div>
  );
}
