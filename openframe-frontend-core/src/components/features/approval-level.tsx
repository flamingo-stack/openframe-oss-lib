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

/** The approval levels, in the order a choice reads: from "runs on its own" to "never runs". */
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
 * its icon and its colour. The guardrails panel's dropdown, the icon control
 * below and any read-only mark read it, so a level is the same everywhere.
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

export interface ApprovalLevelMarkProps {
  level: ApprovalLevel;
  /** Icon only: the name is the mark's accessible name and its tooltip. Default false (icon and name). */
  iconOnly?: boolean;
  className?: string;
}

/** One level, read-only: its icon in its colour, with its name beside it or as its tooltip. */
export function ApprovalLevelMark({ level, iconOnly = false, className }: ApprovalLevelMarkProps) {
  const { label, hint, Icon, toneClassName } = APPROVAL_LEVEL_META[level];
  const mark = (
    <span className={cn('inline-flex items-center gap-[var(--spacing-system-xxs)] text-h6', toneClassName, className)}>
      <Icon size={ICON_PX} className="shrink-0" aria-hidden />
      {iconOnly ? <span className="sr-only">{label}</span> : label}
    </span>
  );
  return iconOnly ? (
    <TouchFriendlyTooltip content={`${label}: ${hint}`} side="top">
      {mark}
    </TouchFriendlyTooltip>
  ) : (
    mark
  );
}

export interface ApprovalLevelControlProps {
  value: ApprovalLevel;
  onChange: (level: ApprovalLevel) => void;
  /** The id of the element that names what is being decided (the rule's label). */
  'aria-labelledby'?: string;
  /** The level in force, written beside the icons. Default true: a row reads without hovering, and on touch. */
  showLabel?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * A choice of approval level as four icons, one per level, in a single-choice
 * group (arrow keys move, like every toggle group). Each icon has the level's
 * name as its accessible name and a tooltip with what the level means (hover
 * or keyboard focus; a tap selects). The level in force wears its colour, and its name
 * is written beside the group, so the choice never depends on a tooltip.
 */
export function ApprovalLevelControl({
  value,
  onChange,
  'aria-labelledby': labelledBy,
  showLabel = true,
  disabled = false,
  className,
}: ApprovalLevelControlProps) {
  const current = APPROVAL_LEVEL_META[value];
  return (
    <div className={cn('flex shrink-0 items-center gap-[var(--spacing-system-sf)]', className)}>
      {showLabel && <span className={cn('whitespace-nowrap text-h6', current.toneClassName)}>{current.label}</span>}
      <TooltipProvider delayDuration={150}>
        <ToggleGroup
          type="single"
          variant="outline"
          size="sm"
          value={value}
          disabled={disabled}
          // Clicking the level in force reports '' (deselect): a rule always has a level.
          onValueChange={(next: string) => {
            if (next && next !== value) onChange(next as ApprovalLevel);
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
