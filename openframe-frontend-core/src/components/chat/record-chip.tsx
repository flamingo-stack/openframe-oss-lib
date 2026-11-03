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
import { useMessageSourceOf } from './citation-chip';
import { RecordNavWrap, recordMenuActions, recordMenuGroups, useRecordDestination } from './entity-cards/dispatch';
import { InlineChip } from './inline-chip';
import { RecordChipMenu, useRecordActions } from './record-actions';
import { sourceRowInputOf } from './utils/cited-sources';
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

/**
 * TODO(CU-17tkuw61kfy): goes with the old mention token. `old-wire.ts` writes `@word:value` as a record link labelled with
 * the token, and prose holds that shape too (`@redis:6379`). A token no host claimed, of a type that names no record the
 * lib knows, stays the raw text it was: a chip would dress it up as something that opens.
 */
function isUnclaimedToken({ type, id, label }: RecordChipProps): boolean {
  return label === `@${type}:${id}` && defaultTableIdForDocumentType(type) === null;
}

export function RecordChip(props: RecordChipProps) {
  const runtime = useChatRuntime();
  if (isUnclaimedToken(props)) return <span className="text-ods-text-secondary opacity-60">{props.label}</span>;
  if (!runtime) return <InlineChip icon={iconFor(props.type)} label={props.label} />;
  return <LinkedRecordChip {...props} />;
}

function LinkedRecordChip({ type, id, label }: RecordChipProps) {
  const runtime = useRequiredChatRuntime();
  // The message's own source part says where the record lives, as it does for its card: a row this platform cannot
  // read leaves the chip its link.
  const source = useMessageSourceOf(type, id);
  const url = source ? (sourceRowInputOf(source).externalUrl ?? null) : null;
  const { finalChatRef, hostRoute, isNewTab, path } = useRecordDestination({ type, id, title: label, url });
  const handlers = useRecordActions();
  const href = finalChatRef.url;
  const menuGroups = recordMenuGroups(finalChatRef, recordMenuActions(finalChatRef, handlers, runtime));
  return (
    <InlineChip
      icon={iconFor(type)}
      // TODO(CU-17tkuw61kfy): a link that knows no name but the id (an old receipt's token) shows the name its row answers.
      label={finalChatRef.title || label}
      link={
        href
          ? (content, anchor) => (
              <RecordNavWrap
                href={href}
                path={path}
                targetPlatform={finalChatRef.targetPlatform ?? null}
                isNewTab={isNewTab}
                hostRoute={hostRoute}
              >
                <Link
                  href={href}
                  aria-label={anchor.label}
                  aria-hidden={anchor.hidden || undefined}
                  tabIndex={anchor.hidden ? -1 : undefined}
                  className="text-inherit no-underline"
                  {...newTabAnchorAttrs(isNewTab, href, finalChatRef.targetPlatform)}
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
