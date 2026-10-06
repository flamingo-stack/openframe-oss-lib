'use client';

import { type KeyboardEvent, type ReactNode, useRef } from 'react';
import { useContentLgUp } from '../../hooks/ui/use-content-breakpoint';
import { cn } from '../../utils/cn';
import { EntityIcon } from '../icon-display';
import { Chevron02RightIcon } from '../icons-v2-generated/arrows/chevron-02-right-icon';
import { CheckIcon } from '../icons-v2-generated/signs-and-symbols/check-icon';
import { Skeleton } from '../ui/skeleton';
import { SnapCarousel } from '../ui/snap-carousel';
import { TruncateText } from '../ui/truncate-text';

/** One job the product does, as the explorer shows it. Every field is the host's data. */
export interface CapabilityExplorerItem {
  /**
   * The job's key: what `activeId` names. The host owns the element a link to
   * `#id` lands on (an anchor at the section's heading), so no element here
   * carries it: a tab is `capabilityTabId(id)`.
   */
  id: string;
  title: string;
  /** An icons-v2 name. */
  iconName?: string;
  intro: string;
  /** Short bullets under the intro; the first three are shown. */
  highlights?: readonly string[];
  /** One line under the title in the list ("Built on ..."). */
  caption?: string;
  /** A mark beside the title in the list (a generation badge). */
  badge?: ReactNode;
  /**
   * A request in plain words and what happened. `requester` and `responder`
   * are who the two turns belong to in THIS example (a name, a note beside it,
   * the host's own avatar); what is left out falls back to the explorer's
   * labels and marks.
   */
  example?: {
    request: string;
    outcome: string;
    requester?: CapabilityExampleParty;
    responder?: CapabilityExampleParty;
  } | null;
  /** The line pinned under the screen (what it is built on, what it replaces). */
  footer?: ReactNode;
}

/** One side of an example: who it is, as the host draws its people and agents everywhere else. */
export interface CapabilityExampleParty {
  name?: string;
  note?: string;
  /** The host's avatar component for this person or agent, sized for the turn (24px). */
  mark?: ReactNode;
}

export interface CapabilityExplorerLabels {
  /** Names the list of jobs for assistive tech. */
  list: string;
  /** Who asks in the example ("You"). */
  requester: string;
  /** Who answers in the example (the assistant's configured name). */
  responder: string;
  /** A note beside the requester ("to Mingo"). */
  requesterNote?: string;
  /** A note beside the responder ("a few seconds later"). */
  responderNote?: string;
  /** Carousel controls. */
  previous?: string;
  next?: string;
}

export interface CapabilityExplorerProps {
  items: readonly CapabilityExplorerItem[];
  labels: CapabilityExplorerLabels;
  activeId: string;
  onActiveChange: (id: string) => void;
  /** The job's product screen; `compact` is the card rendering. Null: the job has none. */
  renderScreen: (item: CapabilityExplorerItem, options: { compact: boolean }) => ReactNode;
  /** The marks beside the two turns of an example that names nobody of its own. */
  requesterMark?: ReactNode;
  responderMark?: ReactNode;
  className?: string;
}

/**
 * Heights are constants so the panel never moves between jobs and the
 * skeleton is the loaded box: every text is clamped to fit them.
 */
const PANEL_HEIGHT_CLASS = 'h-[824px]';
/** The panel's rows: the copy beside the example, the screen, the footer line. */
const PANEL_TOP_HEIGHT_CLASS = 'h-[256px]';
const PANEL_SCREEN_HEIGHT_CLASS = 'h-[420px]';
const PANEL_FOOTER_HEIGHT_CLASS = 'h-[52px]';
const CARD_HEIGHT_CLASS = 'h-[700px]';
/** Both, for the box shown before the layout is known (literal, so the class is generated). */
const SKELETON_HEIGHT_CLASS = 'h-[700px] content-lg:h-[824px]';

/** The element id of a job's tab (never the job's own id: that is the host's anchor). */
export const capabilityTabId = (id: string): string => `${id}-tab`;

function Highlights({ items, className }: { items: readonly string[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <ul className={cn('flex flex-col gap-2', className)}>
      {items.slice(0, 3).map(text => (
        <li key={text} className="flex min-w-0 items-center gap-2.5">
          <CheckIcon size={16} className="shrink-0 text-ods-flamingo-cyan" />
          <TruncateText variant="h6" triggerClassName="flex-1">
            {text}
          </TruncateText>
        </li>
      ))}
    </ul>
  );
}

function Example({
  example,
  labels,
  requesterMark,
  responderMark,
  className,
}: {
  example: NonNullable<CapabilityExplorerItem['example']>;
  labels: CapabilityExplorerLabels;
  requesterMark?: ReactNode;
  responderMark?: ReactNode;
  className?: string;
}) {
  const who = (name: string, note?: string) => (
    <p className="flex min-w-0 items-baseline gap-2 text-ods-text-primary text-h6">
      <span className="shrink-0">{name}</span>
      {note && <span className="truncate text-ods-text-secondary">{note}</span>}
    </p>
  );
  // The mark is the host's own avatar: its shape says who it is (a person who uses a computer, one who runs it, an agent), so it is never clipped here.
  const mark = (node: ReactNode) =>
    node ? <span className="flex size-6 shrink-0 items-center justify-center">{node}</span> : null;
  const requester = example.requester;
  const responder = example.responder;
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-center gap-3 overflow-hidden rounded-xl border border-ods-border bg-ods-bg px-[var(--spacing-system-mf)] py-[var(--spacing-system-sf)]',
        className,
      )}
    >
      <div className="flex min-w-0 gap-2.5">
        {mark(requester?.mark ?? requesterMark)}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {who(requester?.name ?? labels.requester, requester?.note ?? labels.requesterNote)}
          <TruncateText lines={2} variant="h4" className="min-h-[2lh]">
            {`\u201c${example.request}\u201d`}
          </TruncateText>
        </div>
      </div>
      <div className="flex min-w-0 gap-2.5 border-t border-ods-border pt-3">
        {mark(responder?.mark ?? responderMark)}
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {who(responder?.name ?? labels.responder, responder?.note ?? labels.responderNote)}
          <div className="flex min-w-0 items-start gap-2">
            <CheckIcon size={16} className="mt-0.5 shrink-0 text-ods-flamingo-cyan" />
            <TruncateText lines={2} variant="h6" tone="secondary" className="min-h-[2lh]" triggerClassName="flex-1">
              {example.outcome}
            </TruncateText>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The box the explorer occupies while its data loads, at both layouts. */
export function CapabilityExplorerSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cn(SKELETON_HEIGHT_CLASS, 'w-full', className)} />;
}

/**
 * The jobs a product does, one at a time with its real screen.
 *
 * From the content `lg` step: a vertical tablist (roving focus, arrow keys,
 * Home and End) beside one panel of fixed height: the job's copy and example
 * on top, its screen full width below, the footer pinned. Below it: a swipe
 * carousel of equal-height cards, each with the compact screen.
 *
 * The host owns which job is shown (it reads the URL hash) through `activeId`
 * and `onActiveChange`, and the element a link to a job lands on: nothing here
 * carries a job's id, so an anchor scroll never aims inside the list. In the
 * carousel `activeId` brings that job's card into view (the track moves, the
 * page does not).
 */
export function CapabilityExplorer({
  items,
  labels,
  activeId,
  onActiveChange,
  renderScreen,
  requesterMark,
  responderMark,
  className,
}: CapabilityExplorerProps) {
  const wide = useContentLgUp();
  const listRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) return null;
  // Unknown until measured: one box, so neither layout's ids are in the page twice.
  if (wide === undefined) return <CapabilityExplorerSkeleton className={className} />;

  if (!wide) {
    return (
      <SnapCarousel
        className={className}
        items={items}
        label={labels.list}
        autoAdvanceMs={0}
        prevLabel={labels.previous}
        nextLabel={labels.next}
        getKey={item => item.id}
        focusIndex={items.findIndex(item => item.id === activeId)}
        slideClassName="min-w-0 basis-[86%]"
        renderItem={item => (
          <article
            className={cn(
              'flex w-full min-w-0 flex-col gap-[var(--spacing-system-sf)] overflow-hidden rounded-xl border border-ods-border bg-ods-card p-[var(--spacing-system-mf)]',
              CARD_HEIGHT_CLASS,
            )}
          >
            <div className="flex min-w-0 items-center gap-3">
              {item.iconName && (
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg text-ods-flamingo-cyan">
                  <EntityIcon icon={{ name: item.iconName }} size={18} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <h3 className="flex min-w-0 items-center gap-2 text-ods-text-primary text-h4">
                  <TruncateText as="span" variant="h4" triggerClassName="flex-1">
                    {item.title}
                  </TruncateText>
                  {item.badge}
                </h3>
                {item.caption && (
                  <TruncateText variant="h6" tone="secondary">
                    {item.caption}
                  </TruncateText>
                )}
              </div>
            </div>
            <TruncateText lines={3} variant="h6" tone="secondary" className="min-h-[3lh]">
              {item.intro}
            </TruncateText>
            <div className="shrink-0 overflow-hidden rounded-lg border border-ods-border">
              {renderScreen(item, { compact: true })}
            </div>
            {item.example && (
              <Example
                example={item.example}
                labels={labels}
                requesterMark={requesterMark}
                responderMark={responderMark}
                className="shrink-0"
              />
            )}
            {item.footer && <div className="mt-auto min-w-0 shrink-0 overflow-hidden">{item.footer}</div>}
          </article>
        )}
      />
    );
  }

  const activeIndex = Math.max(
    0,
    items.findIndex(item => item.id === activeId),
  );
  const active = items[activeIndex];
  const panelId = 'capability-explorer-panel';

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = items.length - 1;
    const next =
      event.key === 'ArrowDown'
        ? (activeIndex + 1) % items.length
        : event.key === 'ArrowUp'
          ? (activeIndex + last) % items.length
          : event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? last
              : null;
    if (next === null) return;
    event.preventDefault();
    onActiveChange(items[next].id);
    listRef.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,360px)_minmax(0,1fr)] gap-[var(--spacing-system-lf)]',
        PANEL_HEIGHT_CLASS,
        className,
      )}
    >
      <div
        ref={listRef}
        role="tablist"
        aria-orientation="vertical"
        aria-label={labels.list}
        onKeyDown={onKeyDown}
        className="flex min-h-0 flex-col gap-1 overflow-y-auto"
      >
        {items.map((item, index) => {
          const selected = index === activeIndex;
          return (
            <button
              key={item.id}
              id={capabilityTabId(item.id)}
              type="button"
              role="tab"
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => onActiveChange(item.id)}
              className={cn(
                'flex min-w-0 shrink-0 items-center gap-3.5 rounded-lg border px-3.5 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ods-accent',
                selected ? 'border-ods-border bg-ods-card' : 'border-transparent hover:bg-ods-bg-hover',
              )}
            >
              {item.iconName && (
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-lg border border-ods-border bg-ods-bg',
                    selected ? 'text-ods-flamingo-cyan' : 'text-ods-text-secondary',
                  )}
                >
                  <EntityIcon icon={{ name: item.iconName }} size={18} />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span
                  className={cn(
                    'flex min-w-0 items-center gap-2 text-h4',
                    selected ? 'text-ods-text-primary' : 'text-ods-text-secondary',
                  )}
                >
                  <span className="truncate">{item.title}</span>
                  {item.badge}
                </span>
                {item.caption && (
                  <span className="mt-0.5 block truncate text-ods-text-secondary text-h6" title={item.caption}>
                    {item.caption}
                  </span>
                )}
              </span>
              <Chevron02RightIcon
                size={16}
                className={cn('shrink-0', selected ? 'text-ods-flamingo-cyan' : 'invisible')}
                aria-hidden
              />
            </button>
          );
        })}
      </div>

      <div
        id={panelId}
        role="tabpanel"
        aria-labelledby={capabilityTabId(active.id)}
        className="flex min-h-0 min-w-0 flex-col gap-5 overflow-hidden rounded-xl border border-ods-border bg-ods-card px-8 py-7"
      >
        <div
          className={cn(
            'grid shrink-0 gap-8',
            // A job with no example gives its copy the whole row.
            active.example ? 'grid-cols-[minmax(0,1fr)_minmax(0,380px)]' : 'grid-cols-1',
            PANEL_TOP_HEIGHT_CLASS,
          )}
        >
          <div className="flex min-w-0 flex-col overflow-hidden">
            <TruncateText lines={2} variant="h2" className="mb-2">
              {active.title}
            </TruncateText>
            <TruncateText lines={3} variant="h4" tone="secondary" className="min-h-[3lh]">
              {active.intro}
            </TruncateText>
            <Highlights items={active.highlights ?? []} className="mt-auto" />
          </div>
          {active.example && (
            <Example
              example={active.example}
              labels={labels}
              requesterMark={requesterMark}
              responderMark={responderMark}
            />
          )}
        </div>
        <div className={cn('shrink-0 overflow-hidden rounded-xl border border-ods-border', PANEL_SCREEN_HEIGHT_CLASS)}>
          {renderScreen(active, { compact: false })}
        </div>
        {active.footer && (
          <div className={cn('flex min-w-0 shrink-0 items-center overflow-hidden', PANEL_FOOTER_HEIGHT_CLASS)}>
            {active.footer}
          </div>
        )}
      </div>
    </div>
  );
}
