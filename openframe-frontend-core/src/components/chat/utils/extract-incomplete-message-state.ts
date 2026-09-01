/**
 * Utility for extracting incomplete message state from historical messages
 * Used to continue building messages across realtime connections
 */

import type { InitializeExtras } from '../stream/chat-stream-reducer';
import type { ProcessedMessage, MessageSegment, PendingApproval, ExecutingToolState } from '../types';

/**
 * What the realtime accumulator needs to RESUME an unfinished turn.
 *
 * DERIVED, not restated: this is exactly the reducer's `InitializeExtras`
 * minus `escalatedApprovals` (which only the live stream can produce — it has
 * no historical representation to extract). Hosts pass the result straight
 * into `reducer.initializeWithState(messages, extras)`, so the two must not
 * drift; a structural coincidence is not a contract.
 */
export type IncompleteMessageState = Omit<InitializeExtras, 'escalatedApprovals'>;

/**
 * Extract incomplete message state from the last historical assistant message
 * Used to initialize realtime chunk processor when continuing an incomplete message
 */
export function extractIncompleteMessageState(
  lastMessage: ProcessedMessage | undefined,
): IncompleteMessageState | undefined {
  if (!lastMessage || lastMessage.role !== 'assistant' || typeof lastMessage.content === 'string') {
    return undefined;
  }

  const segments = lastMessage.content;
  const pendingApprovals = new Map<string, PendingApproval>();
  const executingTools = new Map<string, ExecutingToolState>();
  let hasIncompleteState = false;
  // "Incomplete" and "the agent is working" are DIFFERENT questions, and only
  // the second one drives the activity indicator. A pending approval is the
  // clearest case of incomplete-but-idle: the turn is unfinished precisely
  // BECAUSE the agent is blocked on the user, and spinning there claims work
  // that is not happening. Everything below is the complement of that.
  let agentBusy = false;

  segments.forEach((segment, index) => {
    const isLast = index === segments.length - 1;
    switch (segment.type) {
      case 'tool_execution':
        if (segment.data.type === 'EXECUTING_TOOL') {
          const toolKey =
            segment.data.toolExecutionRequestId || `${segment.data.integratedToolType}-${segment.data.toolFunction}`;
          executingTools.set(toolKey, {
            integratedToolType: segment.data.integratedToolType,
            toolFunction: segment.data.toolFunction,
            toolTitle: segment.data.toolTitle,
            toolExplanation: segment.data.toolExplanation,
            parameters: segment.data.parameters,
          });
          hasIncompleteState = true;
          // An EXECUTING with no result: the tool is running right now.
          agentBusy = true;
        }
        break;

      case 'approval_request':
        if (segment.status === 'pending' && segment.data.requestId) {
          pendingApprovals.set(segment.data.requestId, {
            command: segment.data.command,
            explanation: segment.data.explanation,
            approvalType: segment.data.approvalType || 'CLIENT',
          });
          hasIncompleteState = true;
        } else if (isLast && segment.status === 'approved') {
          // The user said yes and the agent has produced NOTHING since — it is
          // executing the command. Position is the only signal here: unlike a
          // batch, a single request carries no execution record, so an approved
          // request that already ran is recognised by the work that follows it.
          //
          // This also has to mark the tail incomplete, or the state never
          // reaches the reducer at all — and the continuation, when it replays,
          // must merge into THIS bubble rather than open a second one.
          hasIncompleteState = true;
          agentBusy = true;
        }
        break;

      case 'approval_batch': {
        // Treat a batch as in-progress until every tool call has a
        // `done` execution OR the batch was rejected. Otherwise the realtime
        // accumulator won't hold the segment and post-approval EXECUTED_TOOL
        // chunks won't be able to merge into it via `applyExecutionToBatch`.
        const allDone =
          !!segment.data.executions &&
          segment.data.toolCalls.every(c => segment.data.executions?.[c.toolExecutionRequestId]?.status === 'done');
        if (segment.status !== 'rejected' && !allDone) {
          hasIncompleteState = true;
        }
        // Approved with tool calls still outstanding — the agent is running
        // them. The execution record makes this position-independent: once
        // every call is `done` the batch stops claiming work.
        if (segment.status === 'approved' && !allDone) {
          agentBusy = true;
        }
        break;
      }

      case 'escalation_offer':
        // A pending offer leaves the turn unfinished so the reducer holds the
        // card and the resolution chunk can flip it in place. It never sets
        // `agentBusy`: Fae is blocked on the user's decision, and on approval
        // she goes SILENT rather than resuming — there is no work to spin for.
        if (!segment.status || segment.status === 'pending') {
          hasIncompleteState = true;
        }
        break;

      case 'context_compaction':
        if (segment.status === 'started') {
          hasIncompleteState = true;
          // Compaction is the agent's own work, not a wait on the user.
          agentBusy = true;
        }
        break;

      // Segment kinds that can NEVER leave a turn resumable. Listed rather than
      // swept up by `default` so the `never` below stays reachable-by-type-only:
      // a new segment kind then fails the build HERE, instead of silently
      // reading as "turn finished" and stranding a live turn on reconnect.
      //
      // - `text` / `thinking` / `guide` are delta streams with no completeness
      //   flag; a body cut off mid-stream is indistinguishable from a finished
      //   one, and calling every trailing paragraph unfinished would resume
      //   every turn in the thread.
      // - `ask` closes the turn: the assistant handed a choice back to the user
      //   and stopped. The pick returns as a NEW user message.
      // - `ticket_escalated` / `ticket_event` are standalone receipts delivered
      //   outside MESSAGE_START/END — there is no agent turn to continue.
      // - `error` ended the turn; resuming it would re-open a bubble the
      //   backend has already abandoned.
      case 'text':
      case 'thinking':
      case 'ask':
      case 'ticket_escalated':
      case 'ticket_event':
      case 'error':
        break;

      default: {
        const _exhaustive: never = segment;
        void _exhaustive;
        break;
      }
    }
  });

  if (!hasIncompleteState) {
    return undefined;
  }

  return {
    existingSegments: segments,
    pendingApprovals: pendingApprovals.size > 0 ? pendingApprovals : undefined,
    executingTools: executingTools.size > 0 ? executingTools : undefined,
    ...(agentBusy ? { agentBusy: true } : {}),
  };
}

/**
 * THREAD-level generalization of `extractIncompleteMessageState`: given a
 * processed thread, look at the TRAILING RUN of consecutive assistant
 * messages (not just the very last row), flatten it to one segment list, and
 * ask the single-message extractor whether that tail is unfinished.
 *
 * Why the run and not the last row: the backend can split one logical turn
 * across several assistant messages (a preamble bubble, then the approval
 * card, then the continuation). The unfinished artifact — a pending approval,
 * an EXECUTING_TOOL with no result, an open compaction — can therefore sit in
 * an EARLIER bubble of the same trailing run, and a last-row-only check
 * reports "complete" while the turn is very much still in flight.
 *
 * SSOT for every "is the tail incomplete?" question — the NATS adapter (which
 * used to inline the single-row check) and hosts replaying a stored thread
 * both call this instead of re-deriving the walk.
 *
 * A trailing non-assistant row (user / error) means the last turn closed →
 * `undefined`.
 */
export function extractIncompleteTailState(
  messages: readonly ProcessedMessage[] | undefined,
): IncompleteMessageState | undefined {
  if (!messages || messages.length === 0) return undefined;

  // Walk back over the trailing consecutive assistant run.
  let start = messages.length;
  while (start > 0 && messages[start - 1]?.role === 'assistant') start -= 1;
  if (start === messages.length) return undefined;

  const segments: MessageSegment[] = [];
  for (let i = start; i < messages.length; i += 1) {
    const content = messages[i]?.content;
    // A string-content assistant row is a plain-text bubble with nothing to
    // resume; skip it rather than aborting — a later row in the same run may
    // still hold the unfinished segment.
    if (Array.isArray(content)) segments.push(...content);
  }
  if (segments.length === 0) return undefined;

  // Reuse the single-message extractor verbatim by handing it a synthetic
  // assistant row carrying the flattened run — one incompleteness rule set,
  // not two.
  return extractIncompleteMessageState({
    ...messages[messages.length - 1],
    role: 'assistant',
    content: segments,
  });
}
