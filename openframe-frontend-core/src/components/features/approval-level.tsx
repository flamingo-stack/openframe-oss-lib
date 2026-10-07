'use client';

import type { ComponentType } from 'react';
import type { ApprovalLevel } from '../../types/permissions';
import { cn } from '../../utils/cn';
import { HeadsetIcon } from '../icons-v2-generated/audio-and-visual/headset-icon';
import { BannedIcon } from '../icons-v2-generated/security/banned-icon';
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon';
import { UserIcon } from '../icons-v2-generated/users/user-icon';
import { ToggleGroup, ToggleGroupItem } from '../toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { TouchFriendlyTooltip } from '../ui/touch-friendly-tooltip';

/**
 * The approval levels, in the order a choice reads: the two that need nobody
 * (allow, never) side by side, then the two that ask someone (a technician,
 * the user) side by side.
 */
export const APPROVAL_LEVELS: readonly ApprovalLevel[] = ['ALLOW', 'DENY', 'ASK_TECHNICIAN', 'ASK_USER'];

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
    Icon: UserIcon,
    toneClassName: 'text-ods-warning',
  },
  ASK_TECHNICIAN: {
    label: 'Ask Technician',
    hint: 'Asks a technician first. Nothing runs until they approve.',
    Icon: HeadsetIcon,
    toneClassName: 'text-ods-warning',
  },
  DENY: { label: 'Restrict', hint: 'Never runs.', Icon: BannedIcon, toneClassName: 'text-ods-error' },
};

const ICON_PX = 16;

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
  className?: string;
}

/**
 * THE way a level is shown, read-only or editable, by one prop: the level's
 * name in its colour, then its icon (read-only) or the four levels' icons as a
 * single-choice group (editable; arrow keys move, like every toggle group).
 * Name, icon, colour and tooltip are `APPROVAL_LEVEL_META`'s in both, so a
 * rule reads the same on a page that shows it and on one that lets it change.
 *
 * Editable, each icon has its level's name as its accessible name and a
 * tooltip with what the level means (hover or keyboard focus; a tap selects).
 */
export function ApprovalLevelView({
  value,
  editable,
  onChange,
  disabled = false,
  showLabel = true,
  'aria-labelledby': labelledBy,
  className,
}: ApprovalLevelViewProps) {
  const current = APPROVAL_LEVEL_META[value];
  const canEdit = editable ?? onChange !== undefined;
  const name = showLabel ? (
    <span className={cn('whitespace-nowrap text-h6', current.toneClassName)}>{current.label}</span>
  ) : null;

  if (!canEdit) {
    const icon = (
      <span className={cn('inline-flex shrink-0', current.toneClassName)}>
        <current.Icon size={ICON_PX} aria-hidden />
        {!showLabel && <span className="sr-only">{current.label}</span>}
      </span>
    );
    return (
      <span className={cn('inline-flex shrink-0 items-center gap-[var(--spacing-system-xxs)]', className)}>
        {name}
        {showLabel ? (
          icon
        ) : (
          <TouchFriendlyTooltip content={`${current.label}: ${current.hint}`} side="top">
            {icon}
          </TouchFriendlyTooltip>
        )}
      </span>
    );
  }

  return (
    <div className={cn('flex shrink-0 items-center gap-[var(--spacing-system-sf)]', className)}>
      {name}
      <TooltipProvider delayDuration={150}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={value}
          disabled={disabled}
          // Clicking the level in force reports '' (deselect): a rule always has a level.
          onValueChange={(next: string) => {
            if (next && next !== value) onChange?.(next as ApprovalLevel);
          }}
          aria-labelledby={labelledBy}
        >
          {APPROVAL_LEVELS.map(level => {
            const { label, hint, Icon, toneClassName } = APPROVAL_LEVEL_META[level];
            return (
              // A plain tooltip (hover and keyboard focus): a tap must SELECT the level, and on
              // touch the name beside the group says what is in force.
              <Tooltip key={level}>
                <TooltipTrigger asChild>
                  <ToggleGroupItem
                    value={level}
                    aria-label={label}
                    className={cn('px-2', level === value && toneClassName)}
                  >
                    <Icon size={ICON_PX} aria-hidden />
                  </ToggleGroupItem>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs">
                  <b>{label}</b>: {hint}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </ToggleGroup>
      </TooltipProvider>
    </div>
  );
}
