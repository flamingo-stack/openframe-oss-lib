'use client';

/**
 * The numbered chip a citation draws in an answer's text (`[3]`). `textWithCitationChips` writes it into a render-only
 * copy of the markdown as a link (`[3](#citation-3)`), and the message's `<a>` override draws this. THE citation chip:
 * no other surface draws one.
 *
 * It reads the message's sources and numbers from the message's context (`./message-citations`) and opens its source
 * where the source's card and its row of the strip open it: the one record resolver (`resolveRecordDestination`)
 * through the one anchor (`RecordAnchor`, over `RecordNavWrap` with its `hostRoute`). A source with no url, or a chat
 * with no runtime (nothing to route through), draws a plain `[3]`.
 */

import { useChatRuntime } from '../../contexts/chat-runtime-context';
import { RecordAnchor } from './entity-cards/dispatch';
import { useMessageSourceOfNumber } from './message-citations';
import { recordLinkTargetOf, resolveRecordDestination } from './utils/card-destination';
import { sourceRowInputOf, sourceTitleOf } from './utils/cited-sources';

const CHIP_CLASS = 'text-ods-text-secondary no-underline text-h6 hover:text-ods-text-primary';

export function CitationChip({ number }: { number: number }) {
  const source = useMessageSourceOfNumber(number);
  const runtime = useChatRuntime();
  const label = `[${number}]`;
  const target =
    source && runtime ? recordLinkTargetOf(resolveRecordDestination(sourceRowInputOf(source), runtime)) : null;
  if (!source || !target) return <span className="text-ods-text-secondary text-h6">{label}</span>;
  return (
    <RecordAnchor destination={target} className={CHIP_CLASS} title={sourceTitleOf(source)}>
      {label}
    </RecordAnchor>
  );
}
