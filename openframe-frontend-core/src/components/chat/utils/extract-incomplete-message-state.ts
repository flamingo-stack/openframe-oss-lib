/**
 * Whether a thread's tail is an unfinished turn, and whether the agent is working on it. Used to continue a message
 * across realtime connections.
 */

import {
  approvalBatchIdOf,
  approvalStatusOf,
  isToolPart,
  type ChatMessage,
  type ChatPart,
  type ChatToolPart,
} from '../../../chat-protocol/chat-message';
import type { InitializeExtras } from '../stream/chat-stream-reducer';

/**
 * What the reducer needs to RESUME an unfinished turn. Hosts pass the result straight into
 * `reducer.initializeWithState(messages, extras)`, so the shape is the reducer's.
 */
export type IncompleteMessageState = Pick<InitializeExtras, 'agentBusy'>;

/** A batch: its rows are parts of one card, so one row's state means little alone. */
function batchIsDenied(parts: readonly ChatPart[], batchId: string): boolean {
  return parts.some(part => isToolPart(part) && approvalBatchIdOf(part) === batchId && part.state === 'output-denied');
}

function batchIsPending(parts: readonly ChatPart[], batchId: string): boolean {
  return parts.some(
    part => isToolPart(part) && approvalBatchIdOf(part) === batchId && approvalStatusOf(part) === 'pending',
  );
}

/**
 * Where one tool part leaves the turn. "Incomplete" and "the agent is working" are DIFFERENT questions, and only the
 * second one drives the activity indicator. A pending approval is the clearest case of incomplete-but-idle: the turn is
 * unfinished precisely BECAUSE the agent is blocked on the user, and spinning there claims work that is not happening.
 */
function toolPartState(part: ChatToolPart, parts: readonly ChatPart[], isLast: boolean): 'open' | 'working' | null {
  const batchId = approvalBatchIdOf(part);
  switch (part.state) {
    case 'output-available':
    case 'output-error':
    case 'output-denied':
      return null;
    case 'approval-requested':
      return 'open';
    case 'input-available':
      if (batchId === undefined) return 'working'; // A run with no result: the tool is running right now.
      if (batchIsDenied(parts, batchId)) return null;
      return batchIsPending(parts, batchId) ? 'open' : 'working';
    case 'approval-responded':
      if (part.approval.approved !== true) return null;
      // A row of a batch keeps its record: it is `output-*` once it ran. A single request has none: an approved request
      // that already ran is recognised by the work that follows it, so only the last thing in the turn is running.
      return batchId !== undefined || isLast ? 'working' : null;
    default: {
      const _exhaustive: never = part;
      return _exhaustive;
    }
  }
}

function incompleteStateOfParts(parts: readonly ChatPart[]): IncompleteMessageState | undefined {
  let incomplete = false;
  let agentBusy = false;

  parts.forEach((part, index) => {
    const isLast = index === parts.length - 1;
    switch (part.type) {
      case 'dynamic-tool': {
        const state = toolPartState(part, parts, isLast);
        if (state !== null) incomplete = true;
        if (state === 'working') agentBusy = true;
        break;
      }

      case 'data-escalation-offer':
        // A pending offer leaves the turn unfinished so the card stays actionable and the resolution chunk can flip it in
        // place. It never sets `agentBusy`: Fae is blocked on the user's decision, and on approval she goes SILENT rather
        // than resuming, so there is no work to spin for.
        if (part.data.status === 'pending') incomplete = true;
        break;

      case 'data-context-compaction':
        if (part.data.status === 'started') {
          incomplete = true;
          // Compaction is the agent's own work, not a wait on the user.
          agentBusy = true;
        }
        break;

      // Parts that can NEVER leave a turn resumable. Listed rather than swept up by `default` so the `never` below stays
      // reachable-by-type-only: a new part fails the build HERE, instead of silently reading as "turn finished" and
      // stranding a live turn on reconnect.
      //
      // - `text` / `reasoning` have no completeness flag a stored row keeps; a body cut off mid-stream is indistinguishable
      //   from a finished one, and calling every trailing paragraph unfinished would resume every turn in the thread.
      // - `source-*`, `file`, `data-record-cards` arrive whole: there is nothing left to finish.
      // - `data-ask` closes the turn: the assistant handed a choice back to the user and stopped. The pick returns as a NEW
      //   user message.
      // - `data-ticket-escalated` / `data-ticket-event` are standalone receipts delivered outside MESSAGE_START/END: there
      //   is no agent turn to continue.
      // - `data-error` ended the turn; resuming it would re-open a bubble the backend has already abandoned.
      // - `data-suggestions` is built locally by the host and never comes from a turn.
      case 'text':
      case 'reasoning':
      case 'source-url':
      case 'source-document':
      case 'file':
      case 'data-record-cards':
      case 'data-ask':
      case 'data-ticket-escalated':
      case 'data-ticket-event':
      case 'data-error':
      case 'data-suggestions':
        break;

      default: {
        const _exhaustive: never = part;
        void _exhaustive;
        break;
      }
    }
  });

  if (!incomplete) return undefined;
  return agentBusy ? { agentBusy: true } : {};
}

/**
 * Is a thread's tail unfinished? Looks at the TRAILING RUN of consecutive assistant messages (not just the very last row),
 * flattened to one part list.
 *
 * Why the run and not the last row: the backend can split one logical turn across several assistant messages (a preamble
 * bubble, then the approval card, then the continuation). The unfinished artifact (a pending approval, an EXECUTING_TOOL
 * with no result, an open compaction) can therefore sit in an EARLIER bubble of the same trailing run, and a last-row-only
 * check reports "complete" while the turn is very much still in flight.
 *
 * SSOT for every "is the tail incomplete?" question.
 *
 * A trailing non-assistant row means the last turn closed: `undefined`.
 */
export function extractIncompleteTailState(
  messages: readonly ChatMessage[] | undefined,
): IncompleteMessageState | undefined {
  if (!messages || messages.length === 0) return undefined;

  // Walk back over the trailing consecutive assistant run.
  let start = messages.length;
  while (start > 0 && messages[start - 1]?.role === 'assistant') start -= 1;
  if (start === messages.length) return undefined;

  const parts: ChatPart[] = [];
  for (let i = start; i < messages.length; i += 1) parts.push(...messages[i].parts);
  return incompleteStateOfParts(parts);
}
