'use client'

import { useMemo, useState } from 'react'
import { Button } from '../../ui/button'
import { ApprovalBatchMessage, ApprovalStatusTag } from '../../chat/approval-batch-message'
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
  const [processing, setProcessing] = useState(false)
  // Optimistic status for this user's own click; backend resolution (below) wins once it arrives.
  const [localStatus, setLocalStatus] = useState<ChatApprovalStatus | null>(null)

  const approval = getApprovalMeta(notification)
  const resolvedStatus = resolutionToStatus(approval?.resolution)
  const status: ChatApprovalStatus = resolvedStatus !== 'pending' ? resolvedStatus : (localStatus ?? 'pending')

  const batchData = useMemo(() => (approval ? approvalMetaToBatchData(approval) : null), [approval])

  const { innerRef, containerStyle } = useCollapsible({ expanded })

  if (!approval || !batchData) return null

  const tileNotification: Notification = {
    ...notification,
    type: notification.type ?? 'Approval Required',
  }

  const commandWord = batchData.toolCalls.length > 1 ? 'commands' : 'command'
  const toggleLabel = `${expanded ? 'Hide' : 'Show'} ${commandWord} section`

  const resolve = async (
    nextStatus: 'approved' | 'rejected',
    action: (approvalRequestId: string) => void | Promise<void>,
  ) => {
    setProcessing(true)
    setLocalStatus(nextStatus)
    try {
      await action(batchData.approvalRequestId)
    } catch {
      setLocalStatus(null) // roll back the optimistic flip; the request failed
      return
    } finally {
      setProcessing(false)
    }
    // Outside the try: a throwing consumer callback must not roll back a request
    // that already succeeded server-side.
    onComplete(notification.id)
  }

  return (
    <NotificationTile
      notification={tileNotification}
      liveDurationMs={liveDurationMs}
      onComplete={onComplete}
      onSettle={onSettle}
      className={className}
      paused={pinned || processing}
      actions={
        <div className="flex w-full items-center gap-[var(--spacing-system-xs)]">
          {status === 'pending' ? (
            <>
              <Button variant="accent" size="small" onClick={() => resolve('approved', onApprove)} disabled={processing}>
                Approve
              </Button>
              <Button variant="outline" size="small" onClick={() => resolve('rejected', onReject)} disabled={processing}>
                Reject
              </Button>
            </>
          ) : (
            <span className="flex min-w-0 items-center gap-[var(--spacing-system-xsf)]">
              <ApprovalStatusTag status={status} />
              {approval.resolvedByName ? (
                <span className="truncate text-h6 text-ods-text-secondary">by {approval.resolvedByName}</span>
              ) : null}
            </span>
          )}
          <Button
            variant="outline"
            size="small"
            onClick={() => {
              setExpanded(prev => !prev)
              setPinned(true)
            }}
            aria-expanded={expanded}
            aria-label={toggleLabel}
            className="ml-auto w-6 shrink-0 px-0 md:w-8"
          >
            <ExpandChevron expanded={expanded} />
          </Button>
        </div>
      }
    >
      <div style={containerStyle}>
        {/* Divider lives inside the measured element — useCollapsible caps the
            container at the inner scrollHeight, which excludes the inner's own borders. */}
        <div ref={innerRef}>
          <div className="border-t border-ods-border">
            <ApprovalBatchMessage
              data={batchData}
              showExecutionStatus={false}
              showFooterActions={false}
              maxBodyHeight="50vh"
              className="mb-0 rounded-none border-0"
            />
          </div>
        </div>
      </div>
    </NotificationTile>
  )
}
