'use client';

/**
 * The sources an answer was given: one chip per table (open a record, or ask about it), cited sources first and the
 * rest behind an expander. THE strip under every answer, in the chat and in a host's transcript viewer
 * (`ChatMessageSources` with `messageOfStoredRow`), so a saved answer shows the sources the live one did. Its own
 * module so a transcript viewer draws it without loading the whole chat.
 */

import type React from 'react';
import { useMemo, useState } from 'react';
import type { ChatMessage } from '../../chat-protocol/chat-message';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import { formatCitationIndices, type SourceGroup } from '../../utils/source-grouping';
import { Button } from '../ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { loadingItemProps } from '../ui/loading-scope';
import type { ChatRef } from './chat-ref.types';
import { RecordAnchor, recordDiscussAction } from './entity-cards/dispatch';
import { useRecordActions } from './record-actions';
import { SourceActionButton } from './source-action-button';
import { recordLinkTargetOf, resolveRecordDestination } from './utils/card-destination';
import { chatChipClass } from './utils/chip-styles';
import {
  FALLBACK_TOP_RETRIEVED,
  groupedRowLabels,
  sourceRowInputOf,
  sourceTitleOf,
  splitCitedSources,
} from './utils/cited-sources';

/**
 * A source's chip, two affordances:
 *  1. Open: click → where the record's card and its citation open it (`resolveRecordDestination` through
 *     `RecordAnchor`, so a route of the host's own stays on the host in every mode). A table's chip opens a menu of
 *     its rows, each with both.
 *  2. Ask: the record's "Ask Mingo"/"Display" (`recordDiscussAction`, the row its "⋯" menu offers), to drill into THIS
 *     row.
 */
function SourceChip(props: {
  group: SourceGroup;
  onDiscuss?: (ref: ChatRef) => void;
  /** The strip's list-item marker, carried by the chip's frame like its loading form's. */
  'data-loading-item'?: boolean;
}) {
  const { group, onDiscuss } = props;
  const marks = loadingItemProps(props);
  const runtime = useRequiredChatRuntime();
  const chatHandlers = useRecordActions();
  const handlers = onDiscuss ? { ...chatHandlers, onDiscuss } : chatHandlers;
  const [first] = group.rows;
  // The one record resolver: the same href, tab and icon the record's card and its citation get.
  const firstDestination = resolveRecordDestination(sourceRowInputOf(first), runtime);
  const Icon = firstDestination.cta.icon;
  const icon = <Icon className="h-3.5 w-3.5" />;
  const chipClass = chatChipClass({ tone: 'secondary' });
  const numbers = group.rows.flatMap(row => (row.number === undefined ? [] : [row.number]));
  // A number exists only for a citation: a chip of records nobody cited prints none.
  const numbered = (label: string) => (numbers.length > 0 ? `[${formatCitationIndices(numbers)}] ${label}` : label);
  const actionOf = (ref: ChatRef | null) => (ref ? recordDiscussAction(ref, handlers) : undefined);

  // A table's chip: a click opens a menu with Open + Ask per row. The menu is the shared `DropdownMenu`, portalled out
  // of the thread: drawn inside it, it faded with the thread's end and sat under the composer dock.
  if (group.tableId) {
    const rowLabels = groupedRowLabels(group.rows);
    const rows = group.rows.map((row, i) => {
      const destination = resolveRecordDestination(sourceRowInputOf(row), runtime);
      const ItemIcon = destination.cta.icon;
      const action = actionOf(destination.cta.chatRef);
      return {
        key: row.sourceId,
        label: rowLabels[i],
        icon: <ItemIcon />,
        target: recordLinkTargetOf(destination),
        ask: action && !action.disabled ? { ...action, label: `${action.label}: ${sourceTitleOf(row)}` } : undefined,
      };
    });
    const rowLabelClass = 'min-w-0 flex-1 truncate';

    return (
      <span className="inline-flex" {...marks}>
        {/* Not modal: the thread keeps scrolling under an open menu, and the menu leaves with its chip. */}
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger className={`${chipClass} cursor-pointer`}>
            {icon}
            <span className="max-w-[160px] truncate">{numbered(group.label)}</span>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="max-h-[min(420px,var(--radix-dropdown-menu-content-available-height))] min-w-[220px] max-w-[340px] overflow-y-auto"
          >
            {rows.map(row => (
              <div
                key={row.key}
                data-testid="source-group-row"
                className="flex items-center gap-[var(--spacing-system-xxs)]"
              >
                {row.target ? (
                  <DropdownMenuItem
                    asChild
                    className="min-w-0 flex-1 text-ods-text-secondary no-underline [&_svg]:size-3.5"
                  >
                    <RecordAnchor destination={row.target}>
                      {row.icon}
                      <span className={rowLabelClass}>{row.label}</span>
                    </RecordAnchor>
                  </DropdownMenuItem>
                ) : (
                  // Nothing to open: the label only, out of the keyboard's way; its Ask still works.
                  <span className="flex min-w-0 flex-1 items-center gap-2 px-2 py-1.5 text-ods-text-secondary text-h6 [&_svg]:size-3.5 [&_svg]:shrink-0">
                    {row.icon}
                    <span className={rowLabelClass}>{row.label}</span>
                  </span>
                )}
                {row.ask && (
                  <DropdownMenuItem
                    aria-label={row.ask.label}
                    title={row.ask.label}
                    onSelect={row.ask.run}
                    className="shrink-0 px-1.5 text-ods-text-secondary"
                  >
                    {row.ask.icon}
                  </DropdownMenuItem>
                )}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    );
  }

  // A row of no table: wrap whatever clickable element each branch produces with the trailing Ask button.
  const chipBody = (
    <>
      {icon}
      <span className="max-w-[160px] truncate">{numbered(group.label)}</span>
    </>
  );
  const wrapChip = (clickable: React.ReactNode) => (
    <span className="inline-flex items-center" {...marks}>
      {clickable}
      <SourceActionButton
        action={actionOf(firstDestination.cta.chatRef)}
        title={sourceTitleOf(first)}
        density="inline"
        className="-mr-1 ml-1"
      />
    </span>
  );

  // A chip that opens something is THE record link (`RecordAnchor`): the one navigation decision, the one click router
  // (`RecordNavWrap`), and the panel closing on a same-tab navigation, exactly as cards and record chips.
  const target = recordLinkTargetOf(firstDestination);
  if (target) {
    return wrapChip(
      <RecordAnchor
        destination={target}
        className={chipClass}
        title={sourceRowInputOf(first).externalUrl ? undefined : group.label}
      >
        {chipBody}
      </RecordAnchor>,
    );
  }

  // No openable destination: static label + Ask affordance only.
  return wrapChip(
    <span className={`${chipClass} cursor-default`} title={group.label}>
      {chipBody}
    </span>,
  );
}

/**
 * The sources strip under an answer: the sources it cited first, the rest behind an expander. THE one strip for every
 * surface that draws an answer, the chat and a host's transcript viewer (with `messageOfStoredRow`), so a saved
 * answer shows the sources the live one did.
 */
export function ChatMessageSources({
  message,
  onDiscuss,
}: {
  message: ChatMessage;
  onDiscuss?: (ref: ChatRef) => void;
}): React.ReactElement | null {
  const { cited, uncited } = useMemo(() => splitCitedSources(message.parts), [message.parts]);
  if (message.role !== 'assistant') return null;
  if (cited.length === 0 && uncited.length === 0) return null;
  return (
    <div className="pb-2">
      <SourceChips cited={cited} uncited={uncited} onDiscuss={onDiscuss} />
    </div>
  );
}

/**
 * Cited-by-default source chip strip (Perplexity / ChatGPT pattern).
 * Cited rows render first; uncited tail hidden behind an expander.
 */
function SourceChips({
  cited,
  uncited,
  onDiscuss,
}: {
  cited: SourceGroup[];
  uncited: SourceGroup[];
  onDiscuss?: (ref: ChatRef) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  if (cited.length === 0) {
    const fallback = uncited.slice(0, FALLBACK_TOP_RETRIEVED);
    if (fallback.length === 0) return null;
    return (
      <div className="mt-2 flex flex-col gap-1.5 border-t border-ods-border pt-2">
        <span className="uppercase text-ods-text-muted text-h6">Top retrieved sources</span>
        <div className="flex flex-wrap gap-1.5">
          {fallback.map(group => (
            <SourceChip data-loading-item key={group.key} group={group} onDiscuss={onDiscuss} />
          ))}
        </div>
      </div>
    );
  }

  const hiddenCount = uncited.reduce((count, group) => count + group.rows.length, 0);
  const hasOverflow = hiddenCount > 0;

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-ods-border pt-2">
      <span className="uppercase text-ods-text-muted text-h6">Sources</span>
      <div className={`flex flex-wrap gap-1.5 ${expanded ? 'max-h-[200px] overflow-y-auto overscroll-contain' : ''}`}>
        {cited.map(group => (
          <SourceChip data-loading-item key={group.key} group={group} onDiscuss={onDiscuss} />
        ))}
        {expanded &&
          uncited.map(group => <SourceChip data-loading-item key={group.key} group={group} onDiscuss={onDiscuss} />)}
        {hasOverflow && (
          <Button
            variant="link"
            size="compact"
            noPaddingX
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            aria-label={expanded ? 'Show fewer sources' : `Show ${hiddenCount} additional retrieved sources`}
          >
            {expanded ? 'Show less' : `+${hiddenCount} more retrieved ${hiddenCount === 1 ? 'source' : 'sources'}`}
          </Button>
        )}
      </div>
    </div>
  );
}
