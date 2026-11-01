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
import { cn } from '../../utils/cn';
import { defaultTableIdForDocumentType, getSourceIconName } from '../../utils/source-icons';
import { RecordNavWrap, recordMenuActions, recordMenuGroups, useRecordDestination } from './entity-cards/dispatch';
import { InlineChip } from './inline-chip';
import { RECORD_CHIP_LEAD_SEGMENT_CLASS, RecordChipActions, useRecordActions } from './record-actions';
import { resolveIcon } from './utils/icon-library';

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
  const chip = (
    <InlineChip
      icon={iconFor(type)}
      label={label}
      className={cn(url && 'hover:bg-ods-bg-hover', menuGroups && RECORD_CHIP_LEAD_SEGMENT_CLASS)}
    />
  );
  const lead = url ? (
    <RecordNavWrap
      href={url}
      path={path}
      targetPlatform={finalChatRef.targetPlatform ?? null}
      isNewTab={isNewTab}
      hostRoute={hostRoute}
    >
      <Link
        href={url}
        className="flex min-w-0 no-underline"
        {...(isNewTab ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {chip}
      </Link>
    </RecordNavWrap>
  ) : (
    chip
  );
  if (!menuGroups) return lead;
  return (
    <RecordChipActions menuGroups={menuGroups} label={finalChatRef.title || label}>
      {lead}
    </RecordChipActions>
  );
}
