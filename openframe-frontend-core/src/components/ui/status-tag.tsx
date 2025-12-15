import React from "react"
import { cn } from "../../utils/cn"

export interface StatusTagProps {
  label: string
  variant?: 'success' | 'warning' | 'error' | 'critical' | 'info' | 'active' | 'inactive' | 'offline'
  isMobile?: boolean
  className?: string
}

export function StatusTag({ 
  label, 
  variant = 'success', 
  isMobile = false, 
  className 
}: StatusTagProps) {
  const variantStyles = {
    success: 'bg-[#2e461f] text-[#5ea62e]',
    warning: 'bg-[#7f6004] text-[#ffc008]',
    error: 'bg-[#461f1f] text-[#ea2e2e]',
    critical: 'bg-[#f36666] text-[#fafafa]',
    info: 'bg-[#3a3a3a] text-[#888888]',
    active: 'bg-[#2e461f] text-[#5ea62e]',
    inactive: 'bg-[#3a3a3a] text-[#888888]',
    offline: 'bg-[#461f1f] text-[#ea2e2e]',
  }

  return (
    <div className={cn(
      "inline-flex items-center justify-center rounded-[6px] h-8 px-2",
      variantStyles[variant] || variantStyles.info,
      className
    )}>
      <span className={cn(
        "font-['Azeret_Mono'] font-medium tracking-[-0.28px] uppercase",
        isMobile ? "text-[12px] leading-[16px] tracking-[-0.24px]" : "text-[14px] leading-[20px]"
      )}>
        {label}
      </span>
    </div>
  )
}