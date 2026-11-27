'use client';

import { usePageTopicStamp } from '../../contexts/page-topics-context';
import { cn } from '../../utils/cn';
import { PageTopicLabel } from '../page-topic-label';
import type { MingoQuickAction } from './mingo-welcome';
import type { QuickActionAccent, QuickActionChip, QuickActionThemeSpec } from './quick-action-chip';
import { QuickActionRow } from './quick-action-row';

export interface QuickActionSetProps {
  /** The actions, in the order to show them (the host puts the page topic's own first). */
  chips: ReadonlyArray<QuickActionChip>;
  /** Tags pinned before the actions that are not actions (see `QuickActionRowProps.leading`). */
  leading?: ReadonlyArray<QuickActionChip>;
  /** Default theme for chips without their own (the agent's accent). */
  theme?: QuickActionThemeSpec;
  /** See `QuickActionRowProps.accent`. */
  accent?: QuickActionAccent;
  /** The actions are still read: the row draws its tags' loading form. */
  loading?: boolean;
  /** The group's accessible name. */
  label?: string;
  /** Print the page's stamp (`PageTopicLabel`, the one the FAQ block prints: the page's address, and on hover the
   *  topic it asks with where the two differ) at the end of the set's line, so whoever tags quick actions on the hub
   *  sees which page this is and which topic it asks for. On the chips' own line, never a line
   *  of its own: it takes no height. Default: the host's choice (`PageTopicsProvider showTopic`), so every surface
   *  that draws the set prints it alike. Drawn in the loading form too, so the set is the same box either way. */
  showTopic?: boolean;
  /** Keep the line's height with no action to show, so whatever sits under or above the set (a composer, a centred
   *  greeting) never moves when a page's actions load, or when a page has none. */
  reserve?: boolean;
  className?: string;
}

/**
 * A chat's quick actions above its composer: the {@link QuickActionRow} (one line of tags that scrolls sideways,
 * "All" pinned at its right), with the page's topic stamped over it where the host asks. Its height is one tag's,
 * whatever the number of actions and while they load, so the composer under it never moves when they land.
 *
 * A click on a tag, or on a row of the All list, calls its `onSelect` (the chat sends the action's prompt).
 */
export function QuickActionSet({
  chips,
  leading,
  theme,
  accent,
  loading = false,
  label = 'Quick actions',
  showTopic: showTopicProp,
  reserve = false,
  className,
}: QuickActionSetProps) {
  const topicStamp = usePageTopicStamp();
  const showTopic = showTopicProp ?? topicStamp;
  const empty = !loading && chips.length === 0 && !leading?.length;
  const row =
    empty && reserve ? (
      // No action to show: the row's loading form, unseen and out of reach, holds the line at the row's own height.
      <div aria-hidden inert className="invisible">
        <QuickActionRow chips={[]} loading label={label} />
      </div>
    ) : (
      <QuickActionRow chips={chips} leading={leading} theme={theme} accent={accent} loading={loading} label={label} />
    );
  if (!showTopic) return <div className={cn('shrink-0', className)}>{row}</div>;
  return (
    <div
      data-testid="quick-action-set-line"
      className={cn('flex shrink-0 items-center gap-[var(--spacing-system-xs)]', className)}
    >
      <div className="min-w-0 flex-1">{row}</div>
      <PageTopicLabel className="shrink-0" />
    </div>
  );
}

export interface MingoQuickActionWallProps {
  quickActions: ReadonlyArray<MingoQuickAction>;
  /** Tags pinned before the actions that are not actions: Mingo's welcome puts "Start Guide Chat" here. Shown also
   *  with no action at all. */
  leading?: ReadonlyArray<MingoQuickAction>;
  /**
   * The actions are still being read: the row draws its tags' loading form, so a host that holds its layout around
   * it (a composer under it, a greeting centred above) does not move when the actions land.
   */
  loading?: boolean;
  /** The tint of the row's own glyph ("All"), see `QuickActionRowProps.accent`. */
  accent?: QuickActionAccent;
  /** See {@link QuickActionSetProps.showTopic}. */
  showTopic?: boolean;
  /** See {@link QuickActionSetProps.reserve}. */
  reserve?: boolean;
  className?: string;
}

const toChip = (action: MingoQuickAction): QuickActionChip => ({
  id: action.id,
  label: action.label,
  icon: action.icon,
  variant: action.variant,
  onSelect: action.onClick,
});

/**
 * Mingo's quick actions as the chat's empty state draws them (`MingoWelcome`): the {@link QuickActionSet}. One
 * component, so a host that shows the actions outside the chat (a docked composer's home) draws the very same row.
 * A page with no action draws nothing, except the page's topic stamp where the host asks for it (whoever tags quick
 * actions on the hub finds exactly the pages that have none yet, and the path to tag on its hover); with `reserve`, the
 * line keeps its height either way.
 */
export function MingoQuickActionWall({
  quickActions,
  leading = [],
  loading = false,
  accent,
  showTopic,
  reserve = false,
  className,
}: MingoQuickActionWallProps) {
  const topicStamp = usePageTopicStamp();
  if (quickActions.length === 0 && leading.length === 0 && !loading && !reserve) {
    return (showTopic ?? topicStamp) ? <PageTopicLabel className={cn('shrink-0 text-right', className)} /> : null;
  }
  return (
    <QuickActionSet
      chips={quickActions.map(toChip)}
      leading={leading.map(toChip)}
      loading={loading}
      accent={accent}
      showTopic={showTopic}
      reserve={reserve}
      className={className}
    />
  );
}
