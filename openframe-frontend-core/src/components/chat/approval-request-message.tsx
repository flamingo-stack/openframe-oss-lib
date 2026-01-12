"use client"

import { forwardRef, HTMLAttributes, useState } from "react"
import { cn } from "../../utils/cn"
import { Button } from "../ui/button"
import { StatusTag } from "../ui/status-tag"
import { CheckCircle, XCircle } from "lucide-react"

export interface ApprovalRequestData {
  command: string
  explanation?: string
  icon?: React.ReactNode
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
    
    const handleApprove = () => {
      setIsProcessing(true)
      try {
        if (onApprove) {
          onApprove(data.requestId)
        }
      } finally {
        setIsProcessing(false)
      }
    }
    
    const handleReject = () => {
      setIsProcessing(true)
      try {
        if (onReject) {
          onReject(data.requestId)
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
            "bg-ods-card border border-ods-border rounded-md p-4 flex flex-col gap-4",
            className
          )}
          {...props}
        >
          {/* Command and icon section */}
          <div className="flex flex-col gap-1">
            <div className="bg-ods-bg border border-ods-border rounded-md p-3 flex gap-2 items-start">
              <code className="font-['DM_Sans'] font-medium text-sm text-ods-text-primary flex-1 leading-5">
                {data.command}
              </code>
              {data.icon && (
                <div className="w-4 h-4 shrink-0 text-ods-text-tertiary">
                  {data.icon}
                </div>
              )}
            </div>
            
            {data.explanation && (
              <p className="font-['DM_Sans'] font-medium text-sm text-ods-text-secondary leading-5">
                {data.explanation}
              </p>
            )}
          </div>
          
          {/* Status indicator */}
          <div className="flex">
            <StatusTag
              label={status === 'approved' ? 'Approved' : 'Rejected'}
              variant={status === 'approved' ? 'success' : 'error'}
              leftIcon={status === 'approved' ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
            />
          </div>
        </div>
      )
    }
    
    return (
      <div
        ref={ref}
        className={cn(
          "bg-ods-card border border-ods-border rounded-md p-4 flex flex-col gap-4",
          className
        )}
        {...props}
      >
        {/* Command and icon section */}
        <div className="flex flex-col gap-1">
          <div className="bg-ods-bg border border-ods-border rounded-md p-3 flex gap-2 items-start">
            <code className="font-['DM_Sans'] font-medium text-sm text-ods-text-primary flex-1 leading-5">
              {data.command}
            </code>
            {data.icon && (
              <div className="w-4 h-4 shrink-0 text-ods-text-tertiary">
                {data.icon}
              </div>
            )}
          </div>
          
          {data.explanation && (
            <p className="font-['DM_Sans'] font-medium text-sm text-ods-text-secondary leading-5">
              {data.explanation}
            </p>
          )}
        </div>
        
        {/* Approve/Reject buttons */}
        <div className="flex gap-4 items-center">
          <Button
            size="sm"
            variant="primary"
            onClick={handleApprove}
            disabled={isProcessing}
            className={cn(
              "bg-ods-accent hover:bg-ods-accent/90",
              "font-['Azeret_Mono'] font-medium sm:!text-sm text-ods-bg uppercase tracking-[-0.28px]",
              "px-2 py-1 h-auto"
            )}
          >
            Approve
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleReject}
            disabled={isProcessing}
            className={cn(
              "bg-ods-bg-secondary border-ods-border",
              "font-['Azeret_Mono'] font-medium sm:!text-sm text-ods-text-primary uppercase tracking-[-0.28px]",
              "hover:bg-ods-bg px-2 py-1 h-auto"
            )}
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