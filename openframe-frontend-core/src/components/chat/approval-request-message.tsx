"use client"

import { forwardRef, HTMLAttributes, useState } from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { CheckCircle, XCircle } from "lucide-react"
import { SimpleMarkdownRenderer } from "../ui/simple-markdown-renderer"

export interface ApprovalRequestData {
  command: string
  description?: string
  risk?: 'low' | 'medium' | 'high'
  details?: string[]
  requestId?: string
}

export interface ApprovalRequestMessageProps extends HTMLAttributes<HTMLDivElement> {
  data: ApprovalRequestData
  onApprove?: (requestId?: string) => void
  onReject?: (requestId?: string) => void
  status?: 'pending' | 'approved' | 'rejected'
}

const ApprovalRequestMessage = forwardRef<HTMLDivElement, ApprovalRequestMessageProps>(
  ({ className, data, onApprove, onReject, status = 'pending', ...props }, ref) => {
    const [isProcessing, setIsProcessing] = useState(false)
    
    const handleApprove = async () => {
      setIsProcessing(true)
      try {
        if (onApprove) {
          await onApprove(data.requestId)
        }
      } finally {
        setIsProcessing(false)
      }
    }
    
    const handleReject = async () => {
      setIsProcessing(true)
      try {
        if (onReject) {
          await onReject(data.requestId)
        }
      } finally {
        setIsProcessing(false)
      }
    }
    
    if (status !== 'pending') {
      return (
        <div
          ref={ref}
          className={cn(
            "rounded-lg p-4 flex items-center gap-3",
            "bg-ods-card border border-ods-border",
            className
          )}
          {...props}
        >
          {status === 'approved' ? (
            <CheckCircle className="w-5 h-5 text-ods-success flex-shrink-0" />
          ) : (
            <XCircle className="w-5 h-5 text-ods-error flex-shrink-0" />
          )}
          <div className="flex-1">
            <p className={cn(
              "text-xs font-medium text-ods-text-secondary mb-2 uppercase tracking-wider"
            )}>
              {status === 'approved' ? 'Approved' : 'Rejected'}
            </p>
            <p className="text-sm text-ods-text-secondary mt-1">
              <code className="font-mono">{data.command}</code>
            </p>
          </div>
        </div>
      )
    }
    
    return (
      <div
        ref={ref}
        className={cn("flex flex-col gap-2", className)}
        {...props}
      >
        <SimpleMarkdownRenderer content={`Would you like me to run: \`${data.command}\`?`}/>
        
        {/* approve/reject buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleApprove}
            disabled={isProcessing}
            className="!h-8 !px-2 !py-0 bg-ods-card border border-ods-border !text-[14px] font-medium text-ods-text-primary uppercase tracking-wider hover:bg-ods-bg-hover"
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleReject}
            disabled={isProcessing}
            className="!h-8 !px-2 !py-0 bg-ods-card border border-ods-border !text-[14px] font-medium text-ods-text-primary uppercase tracking-wider hover:bg-ods-bg-hover"
          >
            Reject
          </Button>
        </div>
      </div>
    )
  }
)

ApprovalRequestMessage.displayName = "ApprovalRequestMessage"

export { ApprovalRequestMessage }