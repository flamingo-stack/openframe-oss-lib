"use client"

import * as React from "react"
import { cn } from "../../utils/cn"

export interface TicketDetailSectionProps {
  /** Section label displayed as uppercase heading */
  label: string
  children: React.ReactNode
  className?: string
}

export function TicketDetailSection({ label, children, className }: TicketDetailSectionProps) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <p className="text-h5 text-ods-text-secondary">{label}</p>
      {children}
    </div>
  )
}
