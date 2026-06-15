'use client'

import { useMemo, useState } from 'react'
import { cn } from '../../../utils/cn'
import { ApprovalBatchMessage } from '../../chat/approval-batch-message'
import { ExpandChevron } from '../../chat/expand-chevron'
import { useCollapsible } from '../../chat/hooks/use-collapsible'
import type { ChatApprovalStatus } from '../../chat/types'
import { NotificationTile } from './notification-tile'
import { approvalMetaToBatchData, getApprovalMeta, resolutionToStatus } from './types'
import type { Notification } from './types'

export interface ApprovalRequestNotificationTileProps {
  notification: Notification
  onApprove: (approvalRequestId: string) => void | Promise<void>
  onReject: (approvalRequestId: string) => void | Promise<void>
  onComplete: (id: string) => void
  onSettle?: (id: string) => void
  liveDurationMs?: number
  defaultExpanded?: boolean
  className?: string
}

export function ApprovalRequestNotificationTile({
  notification,
  onApprove,
  onReject,
  onComplete,
  onSettle,
  liveDurationMs,
  defaultExpanded = false,
  className,
}: ApprovalRequestNotificationTileProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  // Toggling the command section pins the tile so a live pop-up doesn't
  // auto-dismiss out from under the user mid-read.
  const [pinned, setPinned] = useState(defaultExpanded)
  // Optimistic status for this user's own click; backend resolution (below) wins once it arrives.
  const [localStatus, setLocalStatus] = useState<ChatApprovalStatus | null>(null)

  const approval = getApprovalMeta(notification)
  const resolvedStatus = resolutionToStatus(approval?.resolution)
  const status: ChatApprovalStatus = resolvedStatus !== 'pending' ? resolvedStatus : (localStatus ?? 'pending')

  const batchData = useMemo(() => (approval ? approvalMetaToBatchData(approval) : null), [approval])

  const { innerRef, containerStyle } = useCollapsible({ expanded })

  if (!approval || !batchData) return null

  const commandWord = batchData.toolCalls.length > 1 ? 'Commands' : 'Command'
  const toggleLabel = `${expanded ? 'Hide' : 'Show'} ${commandWord}`

  const handleApprove = async () => {
    setLocalStatus('approved')
    try {
      await onApprove(batchData.approvalRequestId)
      onComplete(notification.id)
    } catch {
      setLocalStatus(null) // roll back the optimistic flip; the request failed
    }
  }
  const handleReject = async () => {
    setLocalStatus('rejected')
    try {
      await onReject(batchData.approvalRequestId)
      onComplete(notification.id)
    } catch {
      setLocalStatus(null)
    }
  }

  return (
    <NotificationTile
      notification={notification}
      liveDurationMs={liveDurationMs}
      onComplete={onComplete}
      onSettle={onSettle}
      className={className}
      paused={pinned}
    >
      {/* Persistent collapse/expand control for the command section. */}
      <button
        type="button"
        onClick={() => {
          setExpanded(prev => !prev)
          setPinned(true)
        }}
        aria-expanded={expanded}
        className={cn(
          'flex w-full items-center gap-[var(--spacing-system-xs)] bg-ods-card px-[var(--spacing-system-s)] py-[var(--spacing-system-xs)] text-left',
          expanded && 'border-b border-ods-border',
        )}
      >
        <span className="min-w-0 flex-1 text-h6 text-ods-text-primary">{toggleLabel}</span>
        <ExpandChevron expanded={expanded} />
      </button>

      <div style={containerStyle}>
        <div ref={innerRef}>
          <ApprovalBatchMessage
            data={batchData}
            status={status}
            resolvedByName={approval.resolvedByName}
            showExecutionStatus={false}
            onApprove={handleApprove}
            onReject={handleReject}
            maxBodyHeight="50vh"
            className="mb-0 rounded-none border-0"
          />
        </div>
      </div>
    </NotificationTile>
  )
}
