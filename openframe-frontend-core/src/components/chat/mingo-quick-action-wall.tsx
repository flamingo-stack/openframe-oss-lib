'use client';

import { usePageTopicStamp } from '../../contexts/page-topics-context';
import { cn } from '../../utils/cn';
import { PageTopicLabel } from '../page-topic-label';
import type { MingoQuickAction } from './mingo-welcome';
import type { QuickActionChip, QuickActionThemeSpec } from './quick-action-chip';
import { QuickActionRow } from './quick-action-row';

export interface QuickActionSetProps {
  /** The actions, in the order to show them (the host puts the page topic's own first). */
  chips: ReadonlyArray<QuickActionChip>;
  /** Tags pinned before the actions that are not actions (see `QuickActionRowProps.leading`). */
  leading?: ReadonlyArray<QuickActionChip>;
  /** Default theme for chips without their own (the agent's accent). */
  theme?: QuickActionThemeSpec;
  /** The actions are still read: the row draws its tags' loading form. */
  loading?: boolean;
  /** The group's accessible name. */
  label?: string;
  /** Print the page's topic (`PageTopicLabel`, the stamp the FAQ block prints) over the set, right-aligned, so
   *  whoever tags quick actions on the hub sees which topic this page asks for. Default: the host's choice
   *  (`PageTopicsProvider showTopic`), so every surface that draws the set prints it alike. Drawn in the loading
   *  form too, so the set is the same box either way. */
  showTopic?: boolean;
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
  loading = false,
  label = 'Quick actions',
  showTopic: showTopicProp,
  className,
}: QuickActionSetProps) {
  const topicStamp = usePageTopicStamp();
  const showTopic = showTopicProp ?? topicStamp;
  const row = <QuickActionRow chips={chips} leading={leading} theme={theme} loading={loading} label={label} />;
  if (!showTopic) return <div className={cn('shrink-0', className)}>{row}</div>;
  return (
    <div className={cn('flex shrink-0 flex-col gap-[var(--spacing-system-xxs)]', className)}>
      <PageTopicLabel className="text-right" />
      {row}
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
  /** See {@link QuickActionSetProps.showTopic}. */
  showTopic?: boolean;
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
 */
export function MingoQuickActionWall({
  quickActions,
  leading = [],
  loading = false,
  showTopic,
  className,
}: MingoQuickActionWallProps) {
  if (quickActions.length === 0 && leading.length === 0 && !loading) return null;
  return (
    <QuickActionSet
      chips={quickActions.map(toChip)}
      leading={leading.map(toChip)}
      loading={loading}
      showTopic={showTopic}
      className={className}
    />
  );
}
