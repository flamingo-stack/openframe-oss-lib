"use client"

import React from 'react'
import { cn } from '../../utils/cn'
import { CheckCircleIcon } from '../icons-v2-generated/signs-and-symbols/check-circle-icon'
import { DeviceType, getDeviceTypeIcon } from '../icons/device-type-icons/get-device-type-icon'

export interface SelectableDeviceCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  type?: DeviceType
  icon?: React.ReactNode
  subtitle?: string
  selected?: boolean
  onSelect?: () => void
}

export function SelectableDeviceCard({
  title,
  type,
  icon,
  subtitle,
  selected = false,
  onSelect,
  className,
  ...props
}: SelectableDeviceCardProps) {
  return (
    <div 
      className={cn(
        "border border-solid box-border",
        "content-stretch flex gap-2 items-center px-4 py-3 relative rounded-[6px]",
        "cursor-pointer transition-all duration-200",
        !selected && "bg-[#212121] border-[#3a3a3a]",
        !selected && "hover:border-[#4a4a4a] hover:bg-[#2a2a2a]",
        selected && "bg-[#7f6004] border-[#ffc008]",
        className
      )}
      onClick={onSelect}
      {...props}
    >
      {/* Icon */}
      <div className="relative shrink-0 size-4 sm:size-6">
        {icon ? (
          <span className={cn(
            "inline-flex",
            selected ? "[&>*]:text-[#ffc008]" : "[&>*]:text-[#888888]"
          )}>
            {icon}
          </span>
        ) : (
          getDeviceTypeIcon(type, { 
            className: cn(
              "size-4 sm:size-6",
              selected ? "text-[#ffc008]" : "text-[#888888]"
            )
          })
        )}
      </div>

      {/* Title and subtitle */}
      <div className="flex-1 flex flex-col font-['DM_Sans'] font-medium items-start justify-center min-h-px min-w-px relative text-ellipsis whitespace-nowrap">
        <p
          className="leading-6 overflow-hidden text-ellipsis relative shrink-0 text-[14px]sm:text-[18px] text-[#fafafa] w-full"
        >
          {title}
        </p>

        {subtitle && (
          <p
            className={cn(
              "leading-5 overflow-hidden text-ellipsis relative shrink-0 text-[12px] sm:text-[14px] w-full",
              selected ? "text-[#ffc008]" : "text-[#888888]"
            )}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Check icon for selected state */}
      {selected && (
        <CheckCircleIcon className="relative shrink-0 size-4 sm:size-6 text-[#ffc008]" />
      )}
    </div>
  )
}