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
  PendingApproval,
  AccumulatorState,
  ChatApprovalStatus,
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
  private currentTextBuffer: string = ''
  private pendingApprovals: Map<string, PendingApproval> = new Map()
  private executingTools: Map<string, { integratedToolType: string; toolFunction: string; parameters?: Record<string, any> }> = new Map()
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
      currentTextBuffer: this.currentTextBuffer,
      pendingApprovals: new Map(this.pendingApprovals),
      executingTools: new Map(this.executingTools),
    }
  }

  /**
   * Reset the accumulator to initial state
   */
  reset(): void {
    this.segments = []
    this.currentTextBuffer = ''
    this.pendingApprovals.clear()
    this.executingTools.clear()
  }

  /**
   * Reset only segments (keep pending state for continued processing)
   */
  resetSegments(): void {
    this.segments = []
    this.currentTextBuffer = ''
  }

  /**
   * Append text to the current message
   * If the last segment is text, append to it; otherwise create a new text segment
   */
  appendText(text: string): MessageSegment[] {
    const lastSegment = this.segments[this.segments.length - 1]
    
    if (lastSegment && lastSegment.type === 'text') {
      this.currentTextBuffer += text
      this.segments[this.segments.length - 1] = { type: 'text', text: this.currentTextBuffer }
    } else {
      this.currentTextBuffer = text
      this.segments.push({ type: 'text', text: this.currentTextBuffer })
    }
    
    return this.getSegments()
  }

  /**
   * Add a tool execution segment
   * If adding EXECUTED_TOOL, replace the matching EXECUTING_TOOL
   */
  addToolExecution(segment: ToolExecutionSegment): MessageSegment[] {
    const toolData = segment.data
    const toolKey = `${toolData.integratedToolType}-${toolData.toolFunction}`
    
    if (toolData.type === 'EXECUTING_TOOL') {
      this.executingTools.set(toolKey, {
        integratedToolType: toolData.integratedToolType,
        toolFunction: toolData.toolFunction,
        parameters: toolData.parameters,
      })
      this.segments.push(segment)
    } else if (toolData.type === 'EXECUTED_TOOL') {
      const existingIndex = this.segments.findIndex(
        (s): s is ToolExecutionSegment =>
          s.type === 'tool_execution' &&
          s.data.type === 'EXECUTING_TOOL' &&
          s.data.integratedToolType === toolData.integratedToolType &&
          s.data.toolFunction === toolData.toolFunction
      )
      
      const executingTool = this.executingTools.get(toolKey)
      const mergedSegment: ToolExecutionSegment = {
        type: 'tool_execution',
        data: {
          ...toolData,
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
   * Update status of an existing approval segment
   */
  updateApprovalStatus(requestId: string, status: ChatApprovalStatus): MessageSegment[] {
    this.segments = this.segments.map(segment => {
      if (segment.type === 'approval_request' && segment.data.requestId === requestId) {
        return { ...segment, status }
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
