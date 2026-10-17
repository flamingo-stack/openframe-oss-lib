import type { ReactNode } from 'react';
import { cn } from '../../utils/cn';
import { trialLabels } from '../../utils/trial';
import { FileOffIcon } from '../icons-v2-generated/documents/file-off-icon';
import { CreditCardXmarkIcon } from '../icons-v2-generated/finance/credit-card-xmark-icon';
import { FlaskVialIcon } from '../icons-v2-generated/school/flask-vial-icon';
import { XmarkAltIcon } from '../icons-v2-generated/signs-and-symbols/xmark-alt-icon';
import { UnifiedSkeleton } from '../loading/unified-skeleton';

export interface BenefitItem {
  /** Drawn at 16px in the quiet colour. */
  icon?: ReactNode;
  label: string;
  /**
   * The item's figure is still loading: its label is drawn as a skeleton over an
   * invisible copy of `label`, so the row keeps its width and its wrapping and
   * nothing moves when the real label arrives. Pass a label of the same shape
   * ("Trusted by 000 businesses"); it is never shown.
   */
  pending?: boolean;
}

/** The mark of each of the trial's terms, wherever a term is listed. */
export const TRIAL_TERM_ICONS = {
  noCard: <CreditCardXmarkIcon />,
  cancel: <XmarkAltIcon />,
  length: <FlaskVialIcon />,
  noContract: <FileOffIcon />,
} as const;
export type TrialTerm = keyof typeof TRIAL_TERM_ICONS;

/** The trial's terms a list shows when its host names none: cancel anytime, the trial's length, no contract. */
export const DEFAULT_TRIAL_TERMS: readonly TrialTerm[] = ['cancel', 'length', 'noContract'];

/** The named terms of the trial as benefits, in the order given. The length is left out when the host does not know it. */
export function trialBenefits(
  trialDays: number | string | null | undefined,
  terms: readonly TrialTerm[] = DEFAULT_TRIAL_TERMS,
): BenefitItem[] {
  const labels = trialLabels(trialDays);
  return terms.flatMap(term => {
    const label = labels[term];
    return label ? [{ icon: TRIAL_TERM_ICONS[term], label }] : [];
  });
}

export interface BenefitListProps {
  /**
   * Which of the trial's terms to list, in order ("cancel", "length",
   * "noContract", "noCard"). Omitted: none, the list is `items` alone.
   */
  terms?: readonly TrialTerm[];
  /** The free trial's length in days, for the `length` term. Without it that term is left out. */
  trialDays?: number | string | null;
  /** The host's own benefits. With `terms`, `itemsFirst` says which come first. */
  items?: BenefitItem[];
  /** Draw `items` before the trial's terms. Default: after them. */
  itemsFirst?: boolean;
  /** `center` centres the row (under a centred hero). Default `start`. */
  align?: 'start' | 'center';
  className?: string;
}

/**
 * THE row of short benefits beside a call to action ("Cancel Anytime", "No
 * Contract"): a small mark and a few words each, wrapping as a row. The one
 * such row everywhere: the sign-up panel, every hero, every closing call to
 * action. A host chooses WHICH benefits (`terms`, `items`), never how they look.
 */
export function BenefitList({
  terms,
  trialDays,
  items = [],
  itemsFirst = false,
  align = 'start',
  className,
}: BenefitListProps) {
  const termItems = terms ? trialBenefits(trialDays, terms) : [];
  const all = itemsFirst ? [...items, ...termItems] : [...termItems, ...items];
  if (all.length === 0) return null;
  return (
    <ul
      className={cn(
        // A full step between benefits, a tighter one between wrapped rows: each reads as its own point.
        'm-0 flex list-none flex-wrap content-center items-center gap-x-[var(--spacing-system-l)] gap-y-[var(--spacing-system-m)] p-0',
        align === 'center' && 'justify-center',
        className,
      )}
    >
      {all.map(item => (
        <li key={item.label} className="flex items-center gap-[var(--spacing-system-xs)]">
          {item.icon && (
            <span
              className="flex size-4 shrink-0 items-center justify-center text-ods-text-secondary [&_svg]:size-4"
              aria-hidden
            >
              {item.icon}
            </span>
          )}
          {item.pending ? (
            <UnifiedSkeleton as="span" width="auto" height="auto" className="inline-block whitespace-nowrap text-transparent text-h4">
              {item.label}
            </UnifiedSkeleton>
          ) : (
            <span className="whitespace-nowrap text-ods-text-primary text-h4">{item.label}</span>
          )}
        </li>
      ))}
    </ul>
  );
}
