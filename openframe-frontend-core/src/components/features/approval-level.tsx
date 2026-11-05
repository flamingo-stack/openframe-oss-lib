'use client';

import type { ComponentType } from 'react';
import type { ApprovalLevel } from '../../types/permissions';
import { cn } from '../../utils/cn';
import { BannedIcon } from '../icons-v2-generated/security/banned-icon';
import { ShieldCheckIcon } from '../icons-v2-generated/security/shield-check-icon';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { UserCheckIcon } from '../icons-v2-generated/users/user-check-icon';
import { UnifiedSkeleton } from '../loading/unified-skeleton';
import { TextHold } from '../ui/layout-hold';
import { useLoadingScope } from '../ui/loading-scope';
import { TabSelector } from '../ui/tab-selector';
import { TouchFriendlyTooltip } from '../ui/touch-friendly-tooltip';

/** The approval levels, from the freest to the strictest, as the guardrails settings order them (Figma 4365-22670). */
export const APPROVAL_LEVELS: readonly ApprovalLevel[] = ['ALLOW', 'ASK_USER', 'ASK_TECHNICIAN', 'DENY'];

export interface ApprovalLevelMeta {
  /** The level's name, as every surface writes it. */
  label: string;
  /** What the level means, in one line: the tooltip of its icon. */
  hint: string;
  Icon: ComponentType<{ size?: number; className?: string }>;
  /** The level's colour when it is the one in force (semantic status tokens). */
  toneClassName: string;
}

/**
 * THE look and wording of an approval level: its name, its one-line meaning,
 * its icon and its colour. The guardrails panel's dropdown and `ApprovalLevelView`
 * below read it, so a level is the same everywhere.
 */
export const APPROVAL_LEVEL_META: Record<ApprovalLevel, ApprovalLevelMeta> = {
  ALLOW: {
    label: 'Allow',
    hint: 'Runs on its own. You get a summary after.',
    Icon: CheckCircleIcon,
    toneClassName: 'text-ods-success',
  },
  ASK_USER: {
    label: 'Ask User',
    hint: 'Asks the person at the computer first.',
    Icon: UserCheckIcon,
    toneClassName: 'text-ods-warning',
  },
  ASK_TECHNICIAN: {
    label: 'Ask Technician',
    hint: 'Asks a technician first. Nothing runs until they approve.',
    Icon: ShieldCheckIcon,
    toneClassName: 'text-ods-warning',
  },
  DENY: { label: 'Restrict', hint: 'Never runs.', Icon: BannedIcon, toneClassName: 'text-ods-error' },
};

/** A read-only level's icon (Figma 1608-49531: 24px, before the name). */
const ICON_PX = 24;

/** The view's layout, read by the view and by its skeleton, so the skeleton is the view's size. */
const READ_ONLY_ROW_CLASS = 'inline-flex shrink-0 items-center gap-[var(--spacing-system-xxs)]';
const EDITABLE_ROW_CLASS = 'flex shrink-0 items-center gap-[var(--spacing-system-m)]';
/** Read-only, the name is the row's value (h4, primary); editable, a caption in the level's colour beside the strip. */
const READ_ONLY_NAME_CLASS = 'whitespace-nowrap text-ods-text-primary text-h4';
const LEVEL_NAME_CLASS = 'whitespace-nowrap text-h6';
/** An editable level's icon (Figma: 20px in the segment). */
const EDITABLE_ICON_PX = 20;
/** The longest level name: the skeleton's name bar is exactly its width (the component's own words, unseen). */
const LONGEST_LEVEL_LABEL = APPROVAL_LEVELS.map(level => APPROVAL_LEVEL_META[level].label).reduce((a, b) =>
  b.length > a.length ? b : a,
);

/** The strip's four levels: the one in force (none while loading) in the primary colour, the others secondary (Figma 4365-22670). */
function levelItems(inForce: ApprovalLevel | undefined) {
  return APPROVAL_LEVELS.map(level => {
    const { label, Icon } = APPROVAL_LEVEL_META[level];
    const tone = level === inForce ? 'text-ods-text-primary' : 'text-ods-text-secondary';
    return { id: level, ariaLabel: label, icon: <Icon size={EDITABLE_ICON_PX} className={tone} aria-hidden /> };
  });
}

export interface ApprovalLevelViewProps {
  /** The level in force. */
  value: ApprovalLevel;
  /**
   * Whether the level can be changed here. `false`: the level's own icon.
   * `true`: four icons, one per level, in a single-choice group. Default: true
   * when `onChange` is given.
   */
  editable?: boolean;
  /** Editable: the level picked. */
  onChange?: (level: ApprovalLevel) => void;
  /** Editable: the group is shown and cannot be changed (a locked rule). */
  disabled?: boolean;
  /**
   * The level's name, written before the icons. Default true: a row reads
   * without hovering, and on touch. False keeps the name as the accessible
   * name (and, read-only, as the icon's tooltip).
   */
  showLabel?: boolean;
  /** Editable: the id of the element that names what is being decided (the rule's label). */
  'aria-labelledby'?: string;
  /** The level is still being read: the view draws its own skeleton (also in a loading scope). */
  loading?: boolean;
  className?: string;
}

/**
 * THE way a level is shown, read-only or editable, by one prop: the level's
 * icon in its colour, then its name (read-only, Figma 1608-49531), or its name
 * in its colour, then the four levels' icons in a compact `TabSelector` strip,
 * the one in force filled (editable, Figma 4365-22670). Name, icon and colour
 * are `APPROVAL_LEVEL_META`'s in both. Editable, each icon has its level's name
 * as its accessible name.
 */
export function ApprovalLevelView({
  value,
  editable,
  onChange,
  disabled = false,
  showLabel = true,
  'aria-labelledby': labelledBy,
  loading = false,
  className,
}: ApprovalLevelViewProps) {
  const canEdit = editable ?? onChange !== undefined;
  // One switch: while the level is read (a prop, or a page's loading scope) the view is its own skeleton.
  if (useLoadingScope() || loading) {
    return <ApprovalLevelSkeleton editable={canEdit} showLabel={showLabel} className={className} />;
  }
  const current = APPROVAL_LEVEL_META[value];

  if (!canEdit) {
    const icon = (
      <span className={cn('inline-flex shrink-0', current.toneClassName)}>
        <current.Icon size={ICON_PX} aria-hidden />
        {!showLabel && <span className="sr-only">{current.label}</span>}
      </span>
    );
    return (
      <span className={cn(READ_ONLY_ROW_CLASS, className)}>
        {showLabel ? (
          icon
        ) : (
          <TouchFriendlyTooltip content={`${current.label}: ${current.hint}`} side="top">
            {icon}
          </TouchFriendlyTooltip>
        )}
        {showLabel && <span className={READ_ONLY_NAME_CLASS}>{current.label}</span>}
      </span>
    );
  }

  const name = showLabel ? <span className={cn(LEVEL_NAME_CLASS, current.toneClassName)}>{current.label}</span> : null;

  return (
    <div className={cn(EDITABLE_ROW_CLASS, className)}>
      {name}
      {/* The settings design's segmented control: one strip, the level in force filled (Figma 4365-22670). */}
      <div role="group" aria-labelledby={labelledBy}>
        <TabSelector
          variant="secondary"
          size="compact"
          value={value}
          disabled={disabled}
          onValueChange={next => {
            if (next !== value) onChange?.(next as ApprovalLevel);
          }}
          items={levelItems(value)}
          className="w-auto"
        />
      </div>
    </div>
  );
}

interface ApprovalLevelSkeletonProps {
  /** The editable form (the four levels' group) or the read-only one (the level's icon). */
  editable?: boolean;
  /** Whether the level's name is written before the icons (default true, like the view). */
  showLabel?: boolean;
  className?: string;
}

/**
 * `ApprovalLevelView`'s own skeleton (a level chip, not a whole view): a level while it is read: the view's own row, the name a bar at its type step (the longest name's width), and the
 * read-only icon's box or the editable strip itself, disabled. Inert: nothing in it can be picked.
 */
function ApprovalLevelSkeleton({ editable = false, showLabel = true, className }: ApprovalLevelSkeletonProps) {
  if (!editable) {
    return (
      <span aria-hidden className={cn(READ_ONLY_ROW_CLASS, className)}>
        <UnifiedSkeleton as="span" className="inline-block shrink-0 rounded-sm" width={ICON_PX} height={ICON_PX} />
        {showLabel && (
          <span className={READ_ONLY_NAME_CLASS}>
            <TextHold>{LONGEST_LEVEL_LABEL}</TextHold>
          </span>
        )}
      </span>
    );
  }
  const name = showLabel ? (
    <span className={LEVEL_NAME_CLASS}>
      <TextHold>{LONGEST_LEVEL_LABEL}</TextHold>
    </span>
  ) : null;
  return (
    <div aria-hidden inert className={cn(EDITABLE_ROW_CLASS, className)}>
      {name}
      {/* The real strip, inert, with no level in force yet. */}
      <TabSelector
        variant="secondary"
        size="compact"
        value=""
        disabled
        onValueChange={() => {}}
        items={levelItems(undefined)}
        className="w-auto"
      />
    </div>
  );
}
