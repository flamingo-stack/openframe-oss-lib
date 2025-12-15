import React from "react"
import { MoreHorizontal } from "lucide-react"
import { cn } from "../../utils/cn"
import { Button } from "./button"
import { StatusTag } from "./status-tag"

export interface LogTableRowProps extends React.HTMLAttributes<HTMLDivElement> {
  logId: string
  timestamp: string
  status: {
    label: string
    variant?: 'success' | 'warning' | 'error' | 'info' | 'critical'
  }
  source: {
    name: string
    icon?: React.ReactNode
  }
  device: {
    name: string
    organization?: string
  }
  description: {
    title: string
    details?: string
  }
  onMoreClick?: () => void
  onDetailsClick?: () => void
}


// Fleet MDM Icon component (simplified version)
const FleetMDMIcon = ({ className }: { className?: string }) => (
  <div className={cn("relative size-4", className)}>
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.33" y="1.33" width="3.34" height="3.34" fill="#888888"/>
      <rect x="6.33" y="1.33" width="3.34" height="3.34" fill="#888888"/>
      <rect x="11.33" y="1.33" width="3.34" height="3.34" fill="#888888"/>
      <rect x="1.33" y="6.33" width="3.34" height="3.34" fill="#888888"/>
      <rect x="6.33" y="6.33" width="3.34" height="3.34" fill="#888888"/>
      <rect x="1.33" y="11.33" width="3.34" height="3.34" fill="#888888"/>
    </svg>
  </div>
)

export function LogTableRow({
  logId,
  timestamp,
  status,
  source,
  device,
  description,
  onMoreClick,
  onDetailsClick,
  className,
  ...props
}: LogTableRowProps) {
  return (
    <div 
      className={cn(
        "relative rounded-[6px] bg-[#212121] border border-[#3a3a3a] overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Desktop Layout - Hidden on mobile */}
      <div className="hidden md:flex items-center gap-4 px-4 py-0 h-20">
        {/* Log ID and Timestamp Cell - Fixed width */}
        <div className="flex flex-col justify-center w-40 shrink-0">
          <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] truncate">
            {logId}
          </span>
          <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-[#888888] truncate">
            {timestamp}
          </span>
        </div>

        {/* Status Cell - Fixed width */}
        <div className="w-32 shrink-0">
          <StatusTag label={status.label} variant={status.variant} />
        </div>

        {/* Source Cell - Fixed width */}
        <div className="flex flex-col justify-center w-40 shrink-0">
          <div className="flex items-center gap-1">
            <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] truncate">
              {source.name}
            </span>
            {source.icon || <FleetMDMIcon />}
          </div>
        </div>

        {/* Device Cell - Fixed width */}
        <div className="flex flex-col justify-center w-40 shrink-0">
          <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] truncate">
            {device.name}
          </span>
          {device.organization && (
            <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-[#888888] truncate">
              {device.organization}
            </span>
          )}
        </div>

        {/* Description Cell - Takes remaining space but doesn't push buttons */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <div className="flex flex-col justify-center">
            <span className="font-['DM_Sans'] font-medium text-[18px] leading-[24px] text-[#fafafa] truncate">
              {description.title}
            </span>
            {description.details && (
              <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-[#888888] truncate">
                {description.details}
              </span>
            )}
          </div>
        </div>

        {/* Actions Container - Fixed position on right */}
        <div className="flex gap-2 items-center shrink-0 ml-auto">
          {/* More Actions Button */}
          <Button
            variant="outline"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              onMoreClick?.()
            }}
            className="bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] h-12 w-12"
            aria-label="More actions"
          >
            <MoreHorizontal className="h-6 w-6 text-[#fafafa]" />
          </Button>

          {/* Log Details Button */}
          <Button
            variant="outline"
            onClick={(e) => {
              e.stopPropagation()
              onDetailsClick?.()
            }}
            className="bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] text-[#fafafa] font-['DM_Sans'] font-bold text-[18px] px-4 py-3 h-12"
            aria-label="View log details"
          >
            Log Details
          </Button>
        </div>
      </div>

      {/* Mobile Layout - Visible only on mobile */}
      <div className="flex md:hidden gap-3 items-center justify-start px-3 py-0 h-20">
        {/* Left section with log info - Fixed width to prevent overlap */}
        <div className="w-24 flex gap-2 items-center justify-start shrink-0 overflow-hidden">
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="flex gap-1 items-center">
              <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-[#fafafa] truncate block">
                {logId}
              </span>
            </div>
            <span className="font-['DM_Sans'] font-medium text-[12px] leading-[16px] text-[#888888] truncate block">
              {timestamp}
            </span>
          </div>
        </div>

        {/* Status tag - Fixed width */}
        <div className="flex gap-2 items-center justify-start shrink-0">
          <StatusTag label={status.label} variant={status.variant} isMobile={true} />
        </div>

        {/* Device and description info - Takes remaining space */}
        <div className="flex-1 flex gap-2 items-center justify-start min-w-0 overflow-hidden">
          <div className="flex-1 flex flex-col justify-center min-w-0">
            <div className="flex gap-1 items-center">
              <span className="font-['DM_Sans'] font-medium text-[14px] leading-[20px] text-[#fafafa] truncate block">
                {device.name || description.title}
              </span>
            </div>
            <span className="font-['DM_Sans'] font-medium text-[12px] leading-[16px] text-[#888888] truncate block">
              {device.organization || description.details}
            </span>
          </div>
        </div>

        {/* More Actions Button */}
        <Button
          variant="outline"
          size="icon"
          onClick={(e) => {
            e.stopPropagation()
            onMoreClick?.()
          }}
          className="bg-[#212121] border-[#3a3a3a] hover:bg-[#2a2a2a] h-12 w-12 shrink-0"
        >
          <MoreHorizontal className="h-6 w-6 text-[#fafafa]" />
        </Button>
      </div>
    </div>
  )
}