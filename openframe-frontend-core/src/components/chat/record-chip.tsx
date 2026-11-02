'use client';

/**
 * The chip a record link draws inside a sentence (`[Mac onboarding guide](record://onboarding_guide/mac-guide)`,
 * `chat-protocol/record-link.ts`) where the host draws none of its own: the record type's icon and the name the
 * answer gave it, in the chat's one inline box (`InlineChip`). It OPENS the record, on the page its card opens:
 * `useRecordDestination` is the card's own answer (the same row query, so a chip beside its card adds no request)
 * and `RecordNavWrap` the card's own click router. Outside a chat runtime (nothing to route through), and for a
 * record no page shows, it is drawn without a link, as `ChatMarkdownLink` draws a link it cannot route.
 */

import { useChatRuntime, useRequiredChatRuntime } from '../../contexts/chat-runtime-context';
import Link from '../../embed-shims/next-link';
import { defaultTableIdForDocumentType, getSourceIconName } from '../../utils/source-icons';
import { RecordNavWrap, recordMenuActions, recordMenuGroups, useRecordDestination } from './entity-cards/dispatch';
import { InlineChip } from './inline-chip';
import { RecordChipMenu, useRecordActions } from './record-actions';
import { resolveIcon } from './utils/icon-library';
import { newTabAnchorAttrs } from './utils/nav-anchor-props';

function iconFor(type: string) {
  const tableId = defaultTableIdForDocumentType(type);
  const name = tableId ? getSourceIconName(tableId) : undefined;
  if (!name) return undefined;
  const Icon = resolveIcon(name, { variant: 'brand' });
  return Icon ? <Icon size={16} /> : undefined;
}

interface RecordChipProps {
  type: string;
  id: string;
  label: string;
}

export function RecordChip(props: RecordChipProps) {
  const runtime = useChatRuntime();
  if (!runtime) return <InlineChip icon={iconFor(props.type)} label={props.label} />;
  return <LinkedRecordChip {...props} />;
}

function LinkedRecordChip({ type, id, label }: RecordChipProps) {
  const runtime = useRequiredChatRuntime();
  const { finalChatRef, hostRoute, isNewTab, path } = useRecordDestination({ type, id, title: label, url: null });
  const handlers = useRecordActions();
  const url = finalChatRef.url;
  const menuGroups = recordMenuGroups(finalChatRef, recordMenuActions(finalChatRef, handlers, runtime));
  return (
    <InlineChip
      icon={iconFor(type)}
      label={label}
      link={
        url
          ? (content, anchor) => (
              <RecordNavWrap
                href={url}
                path={path}
                targetPlatform={finalChatRef.targetPlatform ?? null}
                isNewTab={isNewTab}
                hostRoute={hostRoute}
              >
                <Link
                  href={url}
                  aria-label={anchor.label}
                  aria-hidden={anchor.hidden || undefined}
                  tabIndex={anchor.hidden ? -1 : undefined}
                  className="text-inherit no-underline"
                  {...newTabAnchorAttrs(isNewTab, url, finalChatRef.targetPlatform)}
                >
                  {content}
                </Link>
              </RecordNavWrap>
            )
          : undefined
      }
      trailing={menuGroups ? <RecordChipMenu menuGroups={menuGroups} label={finalChatRef.title || label} /> : undefined}
    />
  );
}
