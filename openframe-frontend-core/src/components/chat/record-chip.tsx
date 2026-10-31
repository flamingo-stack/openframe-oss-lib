'use client';

/**
 * The chip a record link draws inside a sentence (`[Mac onboarding guide](record://onboarding_guide/mac-guide)`,
 * `chat-protocol/record-link.ts`) where the host draws none of its own: the record type's icon and the name the
 * answer gave it, in the chat's one inline box (`InlineChip`). It opens nothing itself: the record's card under the
 * answer carries Open and Discuss.
 */

import { defaultTableIdForDocumentType, getSourceIconName } from '../../utils/source-icons';
import { InlineChip } from './inline-chip';
import { resolveIcon } from './utils/icon-library';

function iconFor(type: string) {
  const tableId = defaultTableIdForDocumentType(type);
  const name = tableId ? getSourceIconName(tableId) : undefined;
  if (!name) return undefined;
  const Icon = resolveIcon(name, { variant: 'brand' });
  return Icon ? <Icon size={16} /> : undefined;
}

export function RecordChip({ type, label }: { type: string; label: string }) {
  return <InlineChip icon={iconFor(type)} label={label} />;
}
