'use client'

import * as React from 'react'
import { cn } from '../../../utils/cn'
import { ApprovalBatchMessage } from '../../chat/approval-batch-message'
import { useCollapsible } from '../../chat/hooks/use-collapsible'
import { Chevron02DownIcon, Chevron02UpIcon, DotsLoaderIcon, ShieldCheckIcon } from '../../icons-v2-generated'
import type { BoardTicketPendingApproval } from './types'

export interface BoardTicketApprovalProps {
  pendingApproval: BoardTicketPendingApproval
  onApprove?: (requestId?: string) => void | Promise<void>
  onReject?: (requestId?: string) => void | Promise<void>
}

/**
 * Inline, collapsed-by-default approval section for a board ticket card. Expands to
 * the shared {@link ApprovalBatchMessage} so the request can be approved/rejected
 * without leaving the board. The header switches between the client variant (grey,
 * "Pending client approval") and the technician/admin variant (yellow shield,
 * "Technician approval required") on `approvalType`.
 */
export function BoardTicketApproval({ pendingApproval, onApprove, onReject }: BoardTicketApprovalProps) {
  const [expanded, setExpanded] = React.useState(false)
  const { innerRef, containerStyle } = useCollapsible({ expanded })
  const isAdmin = pendingApproval.approvalType === 'ADMIN'

  return (
    <div className="pointer-events-auto flex flex-col">
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        aria-expanded={expanded}
        className="flex w-full cursor-pointer items-center gap-[var(--spacing-system-xxs)] text-h6"
      >
        <span
          className={cn(
            'flex min-w-0 flex-1 items-center gap-[var(--spacing-system-xxs)]',
            isAdmin ? 'text-ods-open-yellow' : 'text-ods-text-secondary',
          )}
        >
          {isAdmin ? (
            <ShieldCheckIcon className="size-4 shrink-0" />
          ) : (
            <DotsLoaderIcon size={16} className="shrink-0" />
          )}
          <span className="flex-1 truncate text-left">
            {isAdmin ? 'Technician approval required' : 'Pending client approval'}
          </span>
        </span>
        {expanded ? (
          <Chevron02UpIcon className="size-4 shrink-0 text-ods-text-secondary" />
        ) : (
          <Chevron02DownIcon className="size-4 shrink-0 text-ods-text-secondary" />
        )}
      </button>

      <div style={containerStyle}>
        <div ref={innerRef} className="pt-[var(--spacing-system-xs)]">
          <ApprovalBatchMessage
            className="mb-0"
            data={{
              approvalRequestId: pendingApproval.id,
              approvalType: pendingApproval.approvalType ?? 'CLIENT',
              toolCalls: pendingApproval.toolCalls ?? [],
            }}
            status="pending"
            showExecutionStatus={false}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      </div>
    </div>
  )
}
