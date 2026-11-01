'use client';

/**
 * The sources an answer was given: one chip per source (open it, or ask about it), cited sources first and the rest
 * behind an expander. THE strip under every answer, in the chat and in a host's transcript viewer
 * (`ChatMessageSources` with `messageFromStoredRow`), so a saved answer shows the sources the live one did. Its own
 * module so a transcript viewer draws it without loading the whole chat.
 */

import { MessageSquare } from 'lucide-react';
import type React from 'react';
import { useState } from 'react';
import { useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import { formatCitationIndices } from '../../utils/source-grouping';
import { Button } from '../ui/button';
import { HoverDropdown, type HoverDropdownItem } from '../ui/hover-dropdown';
import { loadingItemProps } from '../ui/loading-scope';
import type { ChatRef } from './chat-ref.types';
import { NavLinkAnchorViaRuntime } from './nav-link-anchor-via-runtime';
import { SourceActionButton } from './source-action-button';
import type { ChatSource, Message } from './types/message.types';
import { chatChipClass } from './utils/chip-styles';
import { FALLBACK_TOP_RETRIEVED, groupedRowLabels, splitCitedSources } from './utils/cited-sources';
import { flattenAssistantContent } from './utils/flatten-assistant-content';
import { resolveSourceRowCTA, sourceRowCtxFromRuntime } from './utils/source-row-cta';

/** Tiny inline replacement for hub's `formatRelativePath`. */
const formatRelativePath = (p: string): string => p.replace(/^\/+/, '').replace(/\/+$/, '');

/**
 * Source chip — TWO affordances per the hub original:
 *  1. Open: click → chip's URL (in-app for docs, new-tab for external).
 *  2. Ask: small `MessageSquare` icon-button on the right → fires
 *     `onDiscuss(ref)` to drill into THIS row via `entityIdFilter`.
 */
function SourceChip(props: {
  src: ChatSource;
  onDiscuss?: (ref: ChatRef) => void;
  /** The strip's list-item marker, carried by the chip's frame like its loading form's. */
  'data-loading-item'?: boolean;
}) {
  const { src, onDiscuss } = props;
  const marks = loadingItemProps(props);
  const runtime = useRequiredChatRuntime();
  // Single CTA resolver — same icon, same href chain, same ChatRef
  // synthesis the inline card and search-result paths use.
  const cta = resolveSourceRowCTA(
    {
      sourceRepo: src.sourceRepo,
      documentType: src.documentType,
      id: src.id,
      title: src.name,
      externalUrl: src.externalUrl,
      targetPlatform: src.targetPlatform ?? null,
      path: src.path,
    },
    sourceRowCtxFromRuntime(runtime),
  );
  const Icon = cta.icon;
  const icon = <Icon className="h-3.5 w-3.5" />;
  const chipClass = chatChipClass({ tone: 'secondary' });

  // Grouped source — hover/click reveals a dropdown with Open + Ask per row.
  if (src.items && src.items.length > 0) {
    // A server-grouped chip answers to one number; a client-built one answers
    // to every number its rows were cited by.
    const itemIndices = src.items.flatMap(item => (item.index === undefined ? [] : [item.index]));
    const rowLabels = groupedRowLabels(src.items);
    const dropdownItems: HoverDropdownItem[] = src.items.map((item, i) => {
      const itemCta = resolveSourceRowCTA(
        {
          sourceRepo: src.sourceRepo,
          documentType: item.documentType,
          id: item.id,
          title: item.name,
          externalUrl: item.externalUrl,
          targetPlatform: item.targetPlatform ?? null,
          path: item.path,
        },
        sourceRowCtxFromRuntime(runtime),
      );
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
        path: item.path ?? null,
        secondaryAction:
          onDiscuss && itemCta.askable && itemChatRef
            ? {
                icon: <MessageSquare />,
                label: `Ask about ${item.name}`,
                onClick: () => onDiscuss(itemChatRef),
              }
            : undefined,
      };
    });

    const groupIndices = itemIndices.length > 0 ? formatCitationIndices(itemIndices) : `${src.index}`;

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
            <span className="max-w-[160px] truncate">
              [{groupIndices}] {src.name}
            </span>
          </span>
        </HoverDropdown>
      </span>
    );
  }

  // Single-row chip helpers — wrap whatever clickable element each branch
  // produces with the trailing Ask `SourceActionButton`.
  const displayName = src.name || formatRelativePath(src.path);
  const chipBody = (label: string) => (
    <>
      {icon}
      <span className="max-w-[160px] truncate">
        [{src.index}] {label}
      </span>
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
    const isEntity = !!src.externalUrl;
    return wrapChip(
      <NavLinkAnchorViaRuntime
        href={cta.href}
        path={isEntity ? null : src.path}
        targetPlatform={cta.targetPlatform ?? null}
        className={chipClass}
        title={isEntity ? undefined : displayName}
      >
        {chipBody(isEntity ? src.name : displayName)}
      </NavLinkAnchorViaRuntime>,
    );
  }

  // No openable destination — static label + Ask affordance only.
  return wrapChip(
    <span className={`${chipClass} cursor-default`} title={displayName}>
      {chipBody(displayName)}
    </span>,
  );
}

/**
 * The sources strip under an answer: the sources it cited first, the rest behind an expander. THE one strip for every
 * surface that draws an answer, the chat and a host's transcript viewer (with `messageFromStoredRow`), so a saved
 * answer shows the sources the live one did.
 */
export function ChatMessageSources({
  message,
  onDiscuss,
}: {
  message: Message;
  onDiscuss?: (ref: ChatRef) => void;
}): React.ReactElement | null {
  if (message.role !== 'assistant') return null;
  const { cited, uncited } = splitCitedSources(message.sources, flattenAssistantContent(message.content));
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
  cited: ChatSource[];
  uncited: ChatSource[];
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
          {fallback.map(src => (
            <SourceChip data-loading-item key={src.index} src={src} onDiscuss={onDiscuss} />
          ))}
        </div>
      </div>
    );
  }

  const hiddenCount = uncited.length;
  const hasOverflow = hiddenCount > 0;

  return (
    <div className="mt-2 flex flex-col gap-1.5 border-t border-ods-border pt-2">
      <span className="uppercase text-ods-text-muted text-h6">Sources</span>
      <div className={`flex flex-wrap gap-1.5 ${expanded ? 'max-h-[200px] overflow-y-auto overscroll-contain' : ''}`}>
        {cited.map(src => (
          <SourceChip data-loading-item key={src.index} src={src} onDiscuss={onDiscuss} />
        ))}
        {expanded &&
          uncited.map(src => <SourceChip data-loading-item key={src.index} src={src} onDiscuss={onDiscuss} />)}
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
