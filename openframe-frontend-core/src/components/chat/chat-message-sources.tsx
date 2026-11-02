'use client';

/**
 * The sources an answer was given: one chip per table (open a record, or ask about it), cited sources first and the
 * rest behind an expander. THE strip under every answer, in the chat and in a host's transcript viewer
 * (`ChatMessageSources` with `messageOfStoredRow`), so a saved answer shows the sources the live one did. Its own
 * module so a transcript viewer draws it without loading the whole chat.
 */

import { MessageSquare } from 'lucide-react';
import type React from 'react';
import { useMemo, useState } from 'react';
import type { ChatMessage } from '../../chat-protocol/chat-message';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import { formatCitationIndices, type SourceGroup } from '../../utils/source-grouping';
import { Button } from '../ui/button';
import { HoverDropdown, type HoverDropdownItem } from '../ui/hover-dropdown';
import { loadingItemProps } from '../ui/loading-scope';
import type { ChatRef } from './chat-ref.types';
import { NavLinkAnchorViaRuntime } from './nav-link-anchor-via-runtime';
import { SourceActionButton } from './source-action-button';
import { chatChipClass } from './utils/chip-styles';
import {
  FALLBACK_TOP_RETRIEVED,
  groupedRowLabels,
  sourceRowInputOf,
  sourceTitleOf,
  splitCitedSources,
} from './utils/cited-sources';
import { resolveSourceRowCTA, sourceRowCtxFromRuntime } from './utils/source-row-cta';

/**
 * Source chip — TWO affordances per the hub original:
 *  1. Open: click → chip's URL (in-app for docs, new-tab for external).
 *  2. Ask: small `MessageSquare` icon-button on the right → fires
 *     `onDiscuss(ref)` to drill into THIS row via `entityIdFilter`.
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
  const ctx = sourceRowCtxFromRuntime(runtime);
  const [first] = group.rows;
  // Single CTA resolver: same icon, same href chain, same ChatRef synthesis the inline card and search-result paths use.
  const firstInput = sourceRowInputOf(first);
  const cta = resolveSourceRowCTA(firstInput, ctx);
  const Icon = cta.icon;
  const icon = <Icon className="h-3.5 w-3.5" />;
  const chipClass = chatChipClass({ tone: 'secondary' });
  const numbers = group.rows.flatMap(row => (row.number === undefined ? [] : [row.number]));
  // A number exists only for a citation: a chip of records nobody cited prints none.
  const numbered = (label: string) => (numbers.length > 0 ? `[${formatCitationIndices(numbers)}] ${label}` : label);

  // A table's chip: hover/click reveals a dropdown with Open + Ask per row.
  if (group.tableId) {
    const rowLabels = groupedRowLabels(group.rows);
    const dropdownItems: HoverDropdownItem[] = group.rows.map((row, i) => {
      const input = sourceRowInputOf(row);
      const itemCta = resolveSourceRowCTA(input, ctx);
      const ItemIcon = itemCta.icon;
      // Read out of the CTA before the `onClick` closure below is built: a
      // property narrowing does not survive into a callback (the property
      // could in principle be reassigned before it fires), so capturing the
      // value is what keeps the handler assertion-free.
      const itemChatRef = itemCta.chatRef;
      return {
        label: rowLabels[i],
        icon: <ItemIcon className="h-3.5 w-3.5" />,
        href: itemCta.href ?? undefined,
        targetPlatform: itemCta.targetPlatform,
        path: input.path ?? null,
        secondaryAction:
          onDiscuss && itemCta.askable && itemChatRef
            ? {
                icon: <MessageSquare />,
                label: `Ask about ${sourceTitleOf(row)}`,
                onClick: () => onDiscuss(itemChatRef),
              }
            : undefined,
      };
    });

    return (
      <span className="inline-flex" {...marks}>
        <HoverDropdown
          items={dropdownItems}
          renderAnchor={({ href, targetPlatform, path, className, children }) => (
            <NavLinkAnchorViaRuntime
              href={href}
              targetPlatform={targetPlatform ?? null}
              path={path}
              className={className}
            >
              {children}
            </NavLinkAnchorViaRuntime>
          )}
        >
          <span className={`${chipClass} cursor-pointer`}>
            {icon}
            <span className="max-w-[160px] truncate">{numbered(group.label)}</span>
          </span>
        </HoverDropdown>
      </span>
    );
  }

  // A row of no table: wrap whatever clickable element each branch produces with the trailing Ask `SourceActionButton`.
  const chipBody = (
    <>
      {icon}
      <span className="max-w-[160px] truncate">{numbered(group.label)}</span>
    </>
  );
  const wrapChip = (clickable: React.ReactNode) => (
    <span className="inline-flex items-center" {...marks}>
      {clickable}
      <SourceActionButton chatRef={cta.chatRef} onDiscuss={onDiscuss} density="inline" className="-mr-1 ml-1" />
    </span>
  );

  // A chip that opens something is THE chat link (`NavLinkAnchorViaRuntime`): the one navigation decision, the one
  // click executor, and the panel closing on a same-tab navigation, exactly as markdown links and cards.
  if (cta.href) {
    return wrapChip(
      <NavLinkAnchorViaRuntime
        href={cta.href}
        path={firstInput.path ?? null}
        targetPlatform={cta.targetPlatform ?? null}
        className={chipClass}
        title={firstInput.externalUrl ? undefined : group.label}
      >
        {chipBody}
      </NavLinkAnchorViaRuntime>,
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
