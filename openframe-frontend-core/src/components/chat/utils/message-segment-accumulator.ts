/**
 * MessageSegmentAccumulator - Manages accumulation of message segments
 *
 * This class handles the logic for:
 * - Accumulating text segments (appending to existing text)
 * - Managing tool execution states (EXECUTING_TOOL -> EXECUTED_TOOL)
 * - Tracking pending approval requests
 * - Creating approval segments when results arrive
 */

import { applyApprovalStatusToSegment, nextBatchExecution, withBatchExecution } from '../stream/message-mutations';
import type {
  AskOptionData,
  MessageSegment,
  ToolExecutionSegment,
  ApprovalRequestField,
  ApprovalRequestSegment,
  ApprovalBatchSegment,
  ApprovalBatchExecutionState,
  ApprovalResolutionHandler,
  EscalationOfferSegment,
  TicketEscalatedData,
  TicketEscalatedSegment,
  TicketEventData,
  TicketEventSegment,
  ContextCompactionSegment,
  PendingApproval,
  PendingToolCallData,
  AccumulatorState,
  ChatApprovalStatus,
  ExecutingToolState,
} from '../types';

export interface AccumulatorCallbacks {
  /** See `ApprovalResolutionHandler` (message.types) — the SSOT for the
   *  approve/reject signature incl. the boolean failure flag. */
  onApprove?: ApprovalResolutionHandler;
  onReject?: ApprovalResolutionHandler;
  /** Escalation offers resolve through the ticket-escalation mutations, NOT
   *  the tool-approval endpoint, so they carry their own pair of handlers.
   *  Sharing `onApprove`/`onReject` would POST an offer id to the approval
   *  endpoint, which has no record of it. */
  onEscalationApprove?: ApprovalResolutionHandler;
  onEscalationReject?: ApprovalResolutionHandler;
}

/**
 * Accumulator for managing message segments during real-time streaming
 * or historical message processing
 */
export class MessageSegmentAccumulator {
  private segments: MessageSegment[] = [];
  private pendingApprovals: Map<string, PendingApproval> = new Map();
  private executingTools: Map<string, ExecutingToolState> = new Map();
  private callbacks: AccumulatorCallbacks = {};

  constructor(callbacks?: AccumulatorCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  /**
   * Set callbacks for approval actions
   */
  setCallbacks(callbacks: AccumulatorCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Initialize accumulator with existing state from an incomplete historical message
   * Used to continue building messages across page refreshes or reconnections
   */
  initializeWithState(state: {
    existingSegments?: MessageSegment[];
    pendingApprovals?: Map<string, PendingApproval>;
    executingTools?: Map<string, ExecutingToolState>;
  }): void {
    if (state.existingSegments) {
      this.segments = [...state.existingSegments];
    }

    if (state.pendingApprovals) {
      this.pendingApprovals = new Map(state.pendingApprovals);
    }

    if (state.executingTools) {
      this.executingTools = new Map(state.executingTools);
    }
  }

  /**
   * Get current segments
   */
  getSegments(): MessageSegment[] {
    return [...this.segments];
  }

  /**
   * Get the state of the accumulator for serialization
   */
  getState(): AccumulatorState {
    return {
      segments: [...this.segments],
      pendingApprovals: new Map(this.pendingApprovals),
      executingTools: new Map(this.executingTools),
    };
  }

  /**
   * Reset the accumulator to initial state
   */
  reset(): void {
    this.segments = [];
    this.pendingApprovals.clear();
    this.executingTools.clear();
  }

  /**
   * Reset only segments (keep pending state for continued processing)
   */
  resetSegments(): void {
    this.segments = [];
  }

  /**
   * Append text to the current message
   * If the last segment is text, append to it; otherwise create a new text segment
   */
  appendText(text: string): MessageSegment[] {
    const lastSegment = this.segments[this.segments.length - 1];

    if (lastSegment && lastSegment.type === 'text') {
      this.segments[this.segments.length - 1] = { type: 'text', text: lastSegment.text + text };
    } else {
      this.segments.push({ type: 'text', text });
    }

    return this.getSegments();
  }

  /**
   * Append thinking text to the current message.
   * If the last segment is thinking, append to it; otherwise start a new thinking segment.
   */
  appendThinking(text: string): MessageSegment[] {
    const lastSegment = this.segments[this.segments.length - 1];

    if (lastSegment && lastSegment.type === 'thinking') {
      this.segments[this.segments.length - 1] = { type: 'thinking', text: lastSegment.text + text };
    } else {
      this.segments.push({ type: 'thinking', text });
    }

    return this.getSegments();
  }

  /**
   * Add a clarification (ask) card. Unlike the three delta streams an ask
   * arrives whole in one chunk, so it is always a NEW segment — never merged
   * into a trailing one. Consecutive cards stay separate segments; the renderer
   * is what pages through a run of them.
   */
  addAsk(question: string, options: AskOptionData[]): MessageSegment[] {
    this.segments.push({ type: 'ask', question, options });
    return this.getSegments();
  }

  /**
   * Add a tool execution segment.
   *
   * Routing:
   *  1) If `toolExecutionRequestId` matches a tool call inside an existing
   *     `approval_batch` segment, merge the state into that batch's
   *     `executions` map (no standalone segment is pushed).
   *  2) Otherwise: pair EXECUTING ↔ EXECUTED by `toolExecutionRequestId`.
   *     If no id is present (older backends), fall back to
   *     `(integratedToolType, toolFunction)` so repeat calls of the same
   *     function don't all bucket under one key.
   */
  addToolExecution(segment: ToolExecutionSegment): MessageSegment[] {
    const toolData = segment.data;
    const execId = toolData.toolExecutionRequestId;

    if (execId && this.applyExecutionToBatch(execId, toolData)) {
      return this.getSegments();
    }

    const toolKey = execId || `${toolData.integratedToolType}-${toolData.toolFunction}`;

    // A tool only runs after its approval gate was granted. Resolve it here.
    this.resolvePendingApprovalForExecution();

    if (toolData.type === 'EXECUTING_TOOL') {
      this.executingTools.set(toolKey, {
        integratedToolType: toolData.integratedToolType,
        toolFunction: toolData.toolFunction,
        toolTitle: toolData.toolTitle,
        toolExplanation: toolData.toolExplanation,
        parameters: toolData.parameters,
      });
      this.segments.push(segment);
    } else if (toolData.type === 'EXECUTED_TOOL') {
      const existingIndex = this.segments.findIndex(
        (s): s is ToolExecutionSegment =>
          s.type === 'tool_execution' &&
          s.data.type === 'EXECUTING_TOOL' &&
          (execId
            ? s.data.toolExecutionRequestId === execId
            : s.data.integratedToolType === toolData.integratedToolType &&
              s.data.toolFunction === toolData.toolFunction),
      );

      const executingTool = this.executingTools.get(toolKey);
      // The backend omits `toolTitle` on EXECUTED_TOOL; restore it from the
      // paired EXECUTING segment (or its tracked state) so the completed
      // segment keeps the human-readable title instead of falling back to the
      // raw `toolFunction`.
      const existingExecuting =
        existingIndex !== -1 ? (this.segments[existingIndex] as ToolExecutionSegment) : undefined;
      const mergedSegment: ToolExecutionSegment = {
        type: 'tool_execution',
        data: {
          ...toolData,
          toolTitle: toolData.toolTitle ?? existingExecuting?.data.toolTitle ?? executingTool?.toolTitle,
          toolExplanation:
            toolData.toolExplanation ?? existingExecuting?.data.toolExplanation ?? executingTool?.toolExplanation,
          parameters: toolData.parameters || executingTool?.parameters,
        },
      };

      if (existingIndex !== -1) {
        this.segments[existingIndex] = mergedSegment;
      } else {
        this.segments.push(mergedSegment);
      }

      this.executingTools.delete(toolKey);
    }

    return this.getSegments();
  }

  /**
   * Try to merge a tool execution event into an existing approval_batch
   * segment whose `toolCalls` contains the same `toolExecutionRequestId`.
   * Returns true when a batch was updated, false when no batch matches.
   */
  private applyExecutionToBatch(execId: string, toolData: ToolExecutionSegment['data']): boolean {
    let matched = false;
    this.segments = this.segments.map(seg => {
      if (matched) return seg;
      if (seg.type !== 'approval_batch') return seg;
      const hasCall = seg.data.toolCalls.some(c => c.toolExecutionRequestId === execId);
      if (!hasCall) return seg;

      const prev: ApprovalBatchExecutionState | undefined = seg.data.executions?.[execId];
      // Shared rule (`nextBatchExecution` from message-mutations): the
      // never-downgrade guard + EXECUTED/EXECUTING ternary — one
      // implementation with the message-array projection.
      const next = nextBatchExecution(prev, toolData);
      matched = true;
      if (next === null) return seg;
      return withBatchExecution(seg, execId, next);
    });
    return matched;
  }

  /**
   * A tool only ever runs after its approval gate was granted. The legacy /
   * single `approval_request` segment carries no `toolExecutionRequestId` to
   * correlate with the execution, and an observer (e.g. a technician
   * mirroring the client chat) may never receive an `APPROVAL_RESULT` chunk —
   * only the tool's `EXECUTING_TOOL` / `EXECUTED_TOOL` events. Treat the
   * arrival of a tool execution as implicit approval of the most recent
   * still-pending gate so the card does not stay stuck `pending` in realtime.
   *
   * The agent stays paused while an approval is outstanding, so there is at
   * most one relevant gate; flipping only the latest pending one is safe and
   * monotonic (never downgrades, can't make a correct state wrong — an
   * unapproved tool cannot execute). `approval_batch` is handled separately by
   * `applyExecutionToBatch` and is intentionally left untouched here.
   */
  private resolvePendingApprovalForExecution(): void {
    for (let i = this.segments.length - 1; i >= 0; i--) {
      const seg = this.segments[i];
      if (seg.type === 'approval_request' && seg.status === 'pending') {
        this.segments[i] = { ...seg, status: 'approved' };
        return;
      }
    }
  }

  /**
   * Track a pending approval request
   */
  trackApprovalRequest(requestId: string, data: PendingApproval): void {
    this.pendingApprovals.set(requestId, data);
  }

  /**
   * Add an approval request segment directly (for CLIENT approvals)
   */
  addApprovalRequest(
    requestId: string,
    command: string,
    explanation: string | undefined,
    approvalType: string,
    status: ChatApprovalStatus = 'pending',
    /** Structured label/value rows. The card prefers them over `explanation`
     *  (see `ApprovalRequestData.fields`). Optional because the agent's own
     *  approvals carry prose. */
    fields?: ApprovalRequestField[],
  ): MessageSegment[] {
    this.segments.push(
      this.buildApprovalRequestSegment(requestId, { command, explanation, approvalType, fields }, status),
    );
    return this.getSegments();
  }

  /**
   * Build one approval-request segment — THE constructor for this segment type.
   *
   * Three paths produce these: `addApprovalRequest` (live stream and replay),
   * `flushPendingApprovals` (tracked-but-unresolved after a history replay) and
   * `processApprovalResult` (a result arriving for a tracked request). They used
   * to hand-write the object each, which is how `fields` reached
   * the card down one path and not the others — the same proposal rendering as a
   * bare title, or losing the marker that routes its buttons to the hub.
   */
  private buildApprovalRequestSegment(
    requestId: string,
    approval: PendingApproval,
    status: ChatApprovalStatus,
  ): ApprovalRequestSegment {
    return {
      type: 'approval_request',
      data: {
        command: approval.command,
        explanation: approval.explanation,
        requestId,
        approvalType: approval.approvalType,
        ...(approval.fields && approval.fields.length > 0 ? { fields: approval.fields } : {}),
      },
      status,
      onApprove: this.callbacks.onApprove,
      onReject: this.callbacks.onReject,
    };
  }

  /**
   * Add a batch approval segment containing multiple tool calls. Upserts by
   * `approvalRequestId`: when a batch with the same id is already in the
   * accumulator, the existing segment is updated in place rather than a
   * second segment being pushed. This matters for the consumer-store replay
   * path, which feeds `[existing..., new...]` into `replaySegments` and would
   * otherwise produce two batch segments for the same approval after a
   * status flip or per-tool execution merge.
   *
   * `approvalType` is the highest-privilege type required across the batch.
   * `executions` is forwarded as-is. On upsert, a new `executions` object
   * overrides the existing one (so the latest replay wins).
   */
  addApprovalBatch(
    approvalRequestId: string,
    approvalType: string,
    toolCalls: PendingToolCallData[],
    status: ChatApprovalStatus = 'pending',
    executions?: Record<string, ApprovalBatchExecutionState>,
    resolvedByName?: string | null,
  ): MessageSegment[] {
    const existingIndex = this.segments.findIndex(
      (s): s is ApprovalBatchSegment => s.type === 'approval_batch' && s.data.approvalRequestId === approvalRequestId,
    );

    if (existingIndex !== -1) {
      const existing = this.segments[existingIndex] as ApprovalBatchSegment;
      const mergedExecutions = executions ?? existing.data.executions;
      this.segments[existingIndex] = {
        ...existing,
        data: {
          approvalRequestId,
          approvalType,
          toolCalls,
          ...(mergedExecutions ? { executions: mergedExecutions } : {}),
        },
        status,
        resolvedByName: resolvedByName ?? existing.resolvedByName,
        onApprove: this.callbacks.onApprove,
        onReject: this.callbacks.onReject,
      };
      return this.getSegments();
    }

    const segment: ApprovalBatchSegment = {
      type: 'approval_batch',
      data: {
        approvalRequestId,
        approvalType,
        toolCalls,
        ...(executions ? { executions } : {}),
      },
      status,
      resolvedByName,
      onApprove: this.callbacks.onApprove,
      onReject: this.callbacks.onReject,
    };

    this.segments.push(segment);
    return this.getSegments();
  }

  /**
   * Process an approval result and create a segment
   * Returns the pending approval data if found
   */
  processApprovalResult(
    requestId: string,
    approved: boolean,
    approvalType: string,
  ): { segment: ApprovalRequestSegment; pendingData: PendingApproval | null } | null {
    const pendingApproval = this.pendingApprovals.get(requestId);
    const status: ChatApprovalStatus = approved ? 'approved' : 'rejected';

    const segment = this.buildApprovalRequestSegment(
      requestId,
      {
        ...pendingApproval,
        command: pendingApproval?.command || '',
        approvalType: pendingApproval?.approvalType || approvalType,
      },
      status,
    );

    this.segments.push(segment);

    if (pendingApproval) {
      this.pendingApprovals.delete(requestId);
    }

    return { segment, pendingData: pendingApproval || null };
  }

  /**
   * Add a ticket-escalation offer block. Upserts by `offerId` for the same
   * reason `addApprovalBatch` does: the consumer-store replay path feeds
   * `[existing..., new...]` back through `replaySegments`, which would
   * otherwise yield two cards for one offer.
   */
  addEscalationOffer(
    offerId: string,
    text: string,
    origin: string | undefined,
    status: ChatApprovalStatus = 'pending',
    resolvedByName?: string | null,
  ): MessageSegment[] {
    const existingIndex = this.segments.findIndex(
      (s): s is EscalationOfferSegment => s.type === 'escalation_offer' && s.data.offerId === offerId,
    );
    const existing = existingIndex !== -1 ? (this.segments[existingIndex] as EscalationOfferSegment) : undefined;

    const segment: EscalationOfferSegment = {
      type: 'escalation_offer',
      // The resolved chunk carries no text/origin — a redelivered offer must
      // not blank the card the PENDING chunk already painted.
      data: { offerId, text: text || existing?.data.text || '', origin: origin ?? existing?.data.origin },
      status,
      resolvedByName: resolvedByName ?? existing?.resolvedByName,
      onApprove: this.callbacks.onEscalationApprove,
      onReject: this.callbacks.onEscalationReject,
    };

    if (existingIndex !== -1) {
      this.segments[existingIndex] = segment;
      return this.getSegments();
    }

    this.segments.push(segment);
    return this.getSegments();
  }

  /**
   * Add the handoff receipt. Upserts by `ticketId` so a redelivered block
   * (JetStream catch-up over hydrated history) can't stack a second notice.
   */
  addTicketEscalated(data: TicketEscalatedData): MessageSegment[] {
    const segment: TicketEscalatedSegment = { type: 'ticket_escalated', data };
    const existingIndex = this.segments.findIndex(
      s => s.type === 'ticket_escalated' && s.data.ticketId === data.ticketId,
    );
    if (existingIndex !== -1) {
      this.segments[existingIndex] = segment;
      return this.getSegments();
    }
    this.segments.push(segment);
    return this.getSegments();
  }

  /**
   * Add a ticket lifecycle receipt (resolved / reopened / unknown kind).
   *
   * Upsert identity is the chunk's stream sequence when BOTH sides know it.
   * The payload fallback exists for one overlap only: history hydration is
   * seq-less (the persisted row's seq lives on the message, not the
   * `messageData`), so a JetStream catch-up redelivery of the same event must
   * still match its hydrated twin. That twin is necessarily the LATEST ticket
   * event, so the fallback may consider only that one — scanning older
   * segments swallowed a genuinely REPEATED event: resolve → reopen → resolve
   * by the same actor is payload-identical to the first resolve, and matching
   * the old card meant the final one never rendered.
   */
  addTicketEvent(data: TicketEventData, streamSeq?: number, occurredAt?: Date): MessageSegment[] {
    const segment: TicketEventSegment = {
      type: 'ticket_event',
      data,
      ...(streamSeq !== undefined ? { streamSeq } : {}),
      ...(occurredAt !== undefined ? { occurredAt } : {}),
    };
    let existingIndex =
      streamSeq !== undefined
        ? this.segments.findIndex(s => s.type === 'ticket_event' && s.streamSeq === streamSeq)
        : -1;
    if (existingIndex === -1) {
      for (let i = this.segments.length - 1; i >= 0; i--) {
        const s = this.segments[i];
        if (s.type !== 'ticket_event') continue;
        // Both seqs known and unequal: proven distinct, never payload-match.
        const seqsDistinguish = s.streamSeq !== undefined && streamSeq !== undefined;
        if (
          !seqsDistinguish &&
          s.data.kind === data.kind &&
          s.data.actorId === data.actorId &&
          s.data.actorName === data.actorName &&
          s.data.actorType === data.actorType &&
          s.data.reason === data.reason &&
          s.data.targetStatusKind === data.targetStatusKind
        ) {
          existingIndex = i;
        }
        break;
      }
    }
    if (existingIndex !== -1) {
      // The FIRST-known time wins: the hydrated twin carries the row's real
      // `createdAt`, while a catch-up redelivery only knows its (late) arrival
      // time — replacing wholesale would regress the card to arrival or, with
      // neither side stamped, to the bubble timestamp.
      const existing = this.segments[existingIndex] as TicketEventSegment;
      const firstKnownOccurredAt = existing.occurredAt ?? segment.occurredAt;
      this.segments[existingIndex] =
        firstKnownOccurredAt !== undefined ? { ...segment, occurredAt: firstKnownOccurredAt } : segment;
      return this.getSegments();
    }
    this.segments.push(segment);
    return this.getSegments();
  }

  /**
   * Update status of an existing approval segment (single, batch, or
   * escalation offer).
   * `resolvedByName` (when provided) is stamped onto the matching batch segment so the
   * resolved card shows "by {name}"; omit it to leave any existing value untouched.
   */
  updateApprovalStatus(
    requestId: string,
    status: ChatApprovalStatus,
    resolvedByName?: string | null,
  ): MessageSegment[] {
    // ONE rule, two containers: `applyApprovalStatusToSegment` is the
    // same predicate the message-array projection uses
    // (`projectApprovalResolutionToMessages`) — anchor status flip AND
    // batch-row execution tick, so this flat-list path can never drift
    // from the projection again (it previously missed the row case).
    this.segments = this.segments.map(segment =>
      applyApprovalStatusToSegment(segment, requestId, status, resolvedByName),
    );
    return this.getSegments();
  }

  /**
   * Get pending approvals that haven't been resolved
   */
  getPendingApprovals(): Map<string, PendingApproval> {
    return new Map(this.pendingApprovals);
  }

  /**
   * Check if there are any pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0;
  }

  /**
   * Create segments for all remaining pending approvals
   */
  flushPendingApprovals(): ApprovalRequestSegment[] {
    const segments: ApprovalRequestSegment[] = [];

    this.pendingApprovals.forEach((approval, requestId) => {
      segments.push(this.buildApprovalRequestSegment(requestId, approval, 'pending'));
    });

    return segments;
  }

  /**
   * Add a context compaction segment with 'started' status
   */
  addContextCompaction(): MessageSegment[] {
    this.segments.push({ type: 'context_compaction', status: 'started' });
    return this.getSegments();
  }

  /**
   * Complete a context compaction segment
   */
  completeContextCompaction(summary?: string): MessageSegment[] {
    const existingIndex = this.segments.findIndex(
      (s): s is ContextCompactionSegment => s.type === 'context_compaction' && s.status === 'started',
    );

    const completedSegment: ContextCompactionSegment = {
      type: 'context_compaction',
      status: 'completed',
      summary,
    };

    if (existingIndex !== -1) {
      this.segments[existingIndex] = completedSegment;
    } else {
      this.segments.push(completedSegment);
    }

    return this.getSegments();
  }

  /**
   * Add an error segment
   */
  addError(title: string, details?: string): MessageSegment[] {
    this.segments.push({ type: 'error', title, details });
    return this.getSegments();
  }

  /**
   * Reset and replay a full segment array through the accumulator.
   */
  replaySegments(segments: MessageSegment[]): MessageSegment[] {
    this.reset();
    for (const segment of segments) {
      switch (segment.type) {
        case 'text':
          if (segment.text) this.appendText(segment.text);
          break;
        case 'thinking':
          if (segment.text) this.appendThinking(segment.text);
          break;
        case 'ask':
          this.addAsk(segment.question, segment.options);
          break;
        case 'tool_execution':
          this.addToolExecution(segment);
          break;
        case 'approval_request': {
          const { data, status } = segment;
          this.addApprovalRequest(
            data.requestId || '',
            data.command,
            data.explanation,
            data.approvalType || '',
            status,
            data.fields,
          );
          break;
        }
        case 'approval_batch': {
          const { data, status, resolvedByName } = segment;
          this.addApprovalBatch(
            data.approvalRequestId,
            data.approvalType,
            data.toolCalls,
            status,
            data.executions,
            resolvedByName,
          );
          break;
        }
        case 'escalation_offer': {
          const { data, status, resolvedByName } = segment;
          this.addEscalationOffer(data.offerId, data.text, data.origin, status, resolvedByName);
          break;
        }
        case 'ticket_escalated':
          this.addTicketEscalated(segment.data);
          break;
        case 'ticket_event':
          this.addTicketEvent(segment.data, segment.streamSeq, segment.occurredAt);
          break;
        case 'error':
          this.addError(segment.title, segment.details);
          break;
        case 'context_compaction':
          if (segment.status === 'started') {
            this.addContextCompaction();
          } else if (segment.status === 'completed') {
            this.completeContextCompaction(segment.summary);
          }
          break;
      }
    }
    return this.getSegments();
  }

  /**
   * Check if segments have any content
   */
  hasContent(): boolean {
    return this.segments.length > 0;
  }

  /**
   * Get the number of segments
   */
  get length(): number {
    return this.segments.length;
  }
}

/**
 * Create a new accumulator instance with callbacks
 */
export function createMessageSegmentAccumulator(callbacks?: AccumulatorCallbacks): MessageSegmentAccumulator {
  return new MessageSegmentAccumulator(callbacks);
}
