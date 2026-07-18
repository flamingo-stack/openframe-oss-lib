/**
 * MessageSegmentAccumulator - Manages accumulation of message segments
 * 
 * This class handles the logic for:
 * - Accumulating text segments (appending to existing text)
 * - Managing tool execution states (EXECUTING_TOOL -> EXECUTED_TOOL)
 * - Tracking pending approval requests
 * - Creating approval segments when results arrive
 */

import type {
  MessageSegment,
  ToolExecutionSegment,
  ApprovalRequestSegment,
  ApprovalBatchSegment,
  ApprovalBatchExecutionState,
  ContextCompactionSegment,
  ErrorSegment,
  PendingApproval,
  PendingToolCallData,
  AccumulatorState,
  ChatApprovalStatus,
  ExecutingToolState,
} from '../types'

export interface AccumulatorCallbacks {
  onApprove?: (requestId?: string) => Promise<void> | void
  onReject?: (requestId?: string) => Promise<void> | void
}

/**
 * Accumulator for managing message segments during real-time streaming
 * or historical message processing
 */
export class MessageSegmentAccumulator {
  private segments: MessageSegment[] = []
  private pendingApprovals: Map<string, PendingApproval> = new Map()
  private executingTools: Map<string, ExecutingToolState> = new Map()
  private callbacks: AccumulatorCallbacks = {}

  constructor(callbacks?: AccumulatorCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks
    }
  }

  /**
   * Set callbacks for approval actions
   */
  setCallbacks(callbacks: AccumulatorCallbacks): void {
    this.callbacks = callbacks
  }

  /**
   * Initialize accumulator with existing state from an incomplete historical message
   * Used to continue building messages across page refreshes or reconnections
   */
  initializeWithState(state: {
    existingSegments?: MessageSegment[]
    pendingApprovals?: Map<string, PendingApproval>
    executingTools?: Map<string, ExecutingToolState>
  }): void {
    if (state.existingSegments) {
      this.segments = [...state.existingSegments]
    }

    if (state.pendingApprovals) {
      this.pendingApprovals = new Map(state.pendingApprovals)
    }

    if (state.executingTools) {
      this.executingTools = new Map(state.executingTools)
    }
  }

  /**
   * Get current segments
   */
  getSegments(): MessageSegment[] {
    return [...this.segments]
  }

  /**
   * Get the state of the accumulator for serialization
   */
  getState(): AccumulatorState {
    return {
      segments: [...this.segments],
      pendingApprovals: new Map(this.pendingApprovals),
      executingTools: new Map(this.executingTools),
    }
  }

  /**
   * Reset the accumulator to initial state
   */
  reset(): void {
    this.segments = []
    this.pendingApprovals.clear()
    this.executingTools.clear()
  }

  /**
   * Reset only segments (keep pending state for continued processing)
   */
  resetSegments(): void {
    this.segments = []
  }

  /**
   * Append text to the current message
   * If the last segment is text, append to it; otherwise create a new text segment
   */
  appendText(text: string): MessageSegment[] {
    const lastSegment = this.segments[this.segments.length - 1]

    if (lastSegment && lastSegment.type === 'text') {
      this.segments[this.segments.length - 1] = { type: 'text', text: lastSegment.text + text }
    } else {
      this.segments.push({ type: 'text', text })
    }

    return this.getSegments()
  }

  /**
   * Append thinking text to the current message.
   * If the last segment is thinking, append to it; otherwise start a new thinking segment.
   */
  appendThinking(text: string): MessageSegment[] {
    const lastSegment = this.segments[this.segments.length - 1]

    if (lastSegment && lastSegment.type === 'thinking') {
      this.segments[this.segments.length - 1] = { type: 'thinking', text: lastSegment.text + text }
    } else {
      this.segments.push({ type: 'thinking', text })
    }

    return this.getSegments()
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
    const toolData = segment.data
    const execId = toolData.toolExecutionRequestId

    if (execId && this.applyExecutionToBatch(execId, toolData)) {
      return this.getSegments()
    }

    const toolKey = execId || `${toolData.integratedToolType}-${toolData.toolFunction}`

    // A tool only runs after its approval gate was granted. Resolve it here.
    this.resolvePendingApprovalForExecution()

    if (toolData.type === 'EXECUTING_TOOL') {
      this.executingTools.set(toolKey, {
        integratedToolType: toolData.integratedToolType,
        toolFunction: toolData.toolFunction,
        toolTitle: toolData.toolTitle,
        parameters: toolData.parameters,
      })
      this.segments.push(segment)
    } else if (toolData.type === 'EXECUTED_TOOL') {
      const existingIndex = this.segments.findIndex(
        (s): s is ToolExecutionSegment =>
          s.type === 'tool_execution' &&
          s.data.type === 'EXECUTING_TOOL' &&
          (execId
            ? s.data.toolExecutionRequestId === execId
            : s.data.integratedToolType === toolData.integratedToolType &&
              s.data.toolFunction === toolData.toolFunction),
      )

      const executingTool = this.executingTools.get(toolKey)
      // The backend omits `toolTitle` on EXECUTED_TOOL; restore it from the
      // paired EXECUTING segment (or its tracked state) so the completed
      // segment keeps the human-readable title instead of falling back to the
      // raw `toolFunction`.
      const existingExecuting =
        existingIndex !== -1 ? (this.segments[existingIndex] as ToolExecutionSegment) : undefined
      const mergedSegment: ToolExecutionSegment = {
        type: 'tool_execution',
        data: {
          ...toolData,
          toolTitle: toolData.toolTitle ?? existingExecuting?.data.toolTitle ?? executingTool?.toolTitle,
          parameters: toolData.parameters || executingTool?.parameters,
        }
      }

      if (existingIndex !== -1) {
        this.segments[existingIndex] = mergedSegment
      } else {
        this.segments.push(mergedSegment)
      }

      this.executingTools.delete(toolKey)
    }

    return this.getSegments()
  }

  /**
   * Try to merge a tool execution event into an existing approval_batch
   * segment whose `toolCalls` contains the same `toolExecutionRequestId`.
   * Returns true when a batch was updated, false when no batch matches.
   */
  private applyExecutionToBatch(execId: string, toolData: ToolExecutionSegment['data']): boolean {
    let matched = false
    this.segments = this.segments.map((seg) => {
      if (matched) return seg
      if (seg.type !== 'approval_batch') return seg
      const hasCall = seg.data.toolCalls.some((c) => c.toolExecutionRequestId === execId)
      if (!hasCall) return seg

      const prev: ApprovalBatchExecutionState | undefined = seg.data.executions?.[execId]
      // Never downgrade a done slot back to executing (redelivered EXECUTING
      // after its EXECUTED already landed) — matched, but unchanged.
      if (toolData.type === 'EXECUTING_TOOL' && prev?.status === 'done') {
        matched = true
        return seg
      }
      const next: ApprovalBatchExecutionState =
        toolData.type === 'EXECUTED_TOOL'
          ? { status: 'done', result: toolData.result, success: toolData.success }
          : { status: 'executing', result: prev?.result, success: prev?.success }

      matched = true
      return {
        ...seg,
        data: {
          ...seg.data,
          executions: { ...(seg.data.executions ?? {}), [execId]: next },
        },
      }
    })
    return matched
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
      const seg = this.segments[i]
      if (seg.type === 'approval_request' && seg.status === 'pending') {
        this.segments[i] = { ...seg, status: 'approved' }
        return
      }
    }
  }

  /**
   * Track a pending approval request
   */
  trackApprovalRequest(requestId: string, data: PendingApproval): void {
    this.pendingApprovals.set(requestId, data)
  }

  /**
   * Add an approval request segment directly (for CLIENT approvals)
   */
  addApprovalRequest(
    requestId: string,
    command: string,
    explanation: string | undefined,
    approvalType: string,
    status: ChatApprovalStatus = 'pending'
  ): MessageSegment[] {
    const segment: ApprovalRequestSegment = {
      type: 'approval_request',
      data: {
        command,
        explanation,
        requestId,
        approvalType,
      },
      status,
      onApprove: this.callbacks.onApprove,
      onReject: this.callbacks.onReject,
    }

    this.segments.push(segment)
    return this.getSegments()
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
      (s): s is ApprovalBatchSegment =>
        s.type === 'approval_batch' && s.data.approvalRequestId === approvalRequestId,
    )

    if (existingIndex !== -1) {
      const existing = this.segments[existingIndex] as ApprovalBatchSegment
      const mergedExecutions = executions ?? existing.data.executions
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
      }
      return this.getSegments()
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
    }

    this.segments.push(segment)
    return this.getSegments()
  }

  /**
   * Process an approval result and create a segment
   * Returns the pending approval data if found
   */
  processApprovalResult(
    requestId: string,
    approved: boolean,
    approvalType: string
  ): { segment: ApprovalRequestSegment; pendingData: PendingApproval | null } | null {
    const pendingApproval = this.pendingApprovals.get(requestId)
    const status: ChatApprovalStatus = approved ? 'approved' : 'rejected'
    
    const segment: ApprovalRequestSegment = {
      type: 'approval_request',
      data: {
        command: pendingApproval?.command || '',
        explanation: pendingApproval?.explanation,
        requestId,
        approvalType: pendingApproval?.approvalType || approvalType,
      },
      status,
      onApprove: this.callbacks.onApprove,
      onReject: this.callbacks.onReject,
    }
    
    this.segments.push(segment)
    
    if (pendingApproval) {
      this.pendingApprovals.delete(requestId)
    }
    
    return { segment, pendingData: pendingApproval || null }
  }

  /**
   * Update status of an existing approval segment (single or batch).
   * `resolvedByName` (when provided) is stamped onto the matching batch segment so the
   * resolved card shows "by {name}"; omit it to leave any existing value untouched.
   */
  updateApprovalStatus(requestId: string, status: ChatApprovalStatus, resolvedByName?: string | null): MessageSegment[] {
    this.segments = this.segments.map(segment => {
      if (segment.type === 'approval_request' && segment.data.requestId === requestId) {
        return { ...segment, status }
      }
      if (segment.type === 'approval_batch' && segment.data.approvalRequestId === requestId) {
        return { ...segment, status, resolvedByName: resolvedByName ?? segment.resolvedByName }
      }
      return segment
    })
    return this.getSegments()
  }

  /**
   * Get pending approvals that haven't been resolved
   */
  getPendingApprovals(): Map<string, PendingApproval> {
    return new Map(this.pendingApprovals)
  }

  /**
   * Check if there are any pending approvals
   */
  hasPendingApprovals(): boolean {
    return this.pendingApprovals.size > 0
  }

  /**
   * Create segments for all remaining pending approvals
   */
  flushPendingApprovals(): ApprovalRequestSegment[] {
    const segments: ApprovalRequestSegment[] = []
    
    this.pendingApprovals.forEach((approval, requestId) => {
      segments.push({
        type: 'approval_request',
        data: {
          command: approval.command,
          explanation: approval.explanation,
          requestId,
          approvalType: approval.approvalType,
        },
        status: 'pending',
        onApprove: this.callbacks.onApprove,
        onReject: this.callbacks.onReject,
      })
    })
    
    return segments
  }

  /**
   * Add a context compaction segment with 'started' status
   */
  addContextCompaction(): MessageSegment[] {
    this.segments.push({ type: 'context_compaction', status: 'started' })
    return this.getSegments()
  }

  /**
   * Complete a context compaction segment
   */
  completeContextCompaction(summary?: string): MessageSegment[] {
    const existingIndex = this.segments.findIndex(
      (s): s is ContextCompactionSegment =>
        s.type === 'context_compaction' && s.status === 'started'
    )

    const completedSegment: ContextCompactionSegment = {
      type: 'context_compaction',
      status: 'completed',
      summary,
    }

    if (existingIndex !== -1) {
      this.segments[existingIndex] = completedSegment
    } else {
      this.segments.push(completedSegment)
    }

    return this.getSegments()
  }

  /**
   * Add an error segment
   */
  addError(title: string, details?: string): MessageSegment[] {
    this.segments.push({ type: 'error', title, details })
    return this.getSegments()
  }

  /**
   * Reset and replay a full segment array through the accumulator.
   */
  replaySegments(segments: MessageSegment[]): MessageSegment[] {
    this.reset()
    for (const segment of segments) {
      switch (segment.type) {
        case 'text':
          if (segment.text) this.appendText(segment.text)
          break
        case 'thinking':
          if (segment.text) this.appendThinking(segment.text)
          break
        case 'tool_execution':
          this.addToolExecution(segment)
          break
        case 'approval_request': {
          const { data, status } = segment
          this.addApprovalRequest(
            data.requestId || '',
            data.command,
            data.explanation,
            data.approvalType || '',
            status,
          )
          break
        }
        case 'approval_batch': {
          const { data, status, resolvedByName } = segment
          this.addApprovalBatch(
            data.approvalRequestId,
            data.approvalType,
            data.toolCalls,
            status,
            data.executions,
            resolvedByName,
          )
          break
        }
        case 'error':
          this.addError(segment.title, segment.details)
          break
        case 'context_compaction':
          if (segment.status === 'started') {
            this.addContextCompaction()
          } else if (segment.status === 'completed') {
            this.completeContextCompaction(segment.summary)
          }
          break
      }
    }
    return this.getSegments()
  }

  /**
   * Check if segments have any content
   */
  hasContent(): boolean {
    return this.segments.length > 0
  }

  /**
   * Get the number of segments
   */
  get length(): number {
    return this.segments.length
  }
}

/**
 * Create a new accumulator instance with callbacks
 */
export function createMessageSegmentAccumulator(callbacks?: AccumulatorCallbacks): MessageSegmentAccumulator {
  return new MessageSegmentAccumulator(callbacks)
}
