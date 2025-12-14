import React from 'react'
import { CheckCircle } from 'lucide-react'
import { cn } from '../../utils/cn'
import { getDeviceTypeIcon, DeviceType } from '../icons/device-type-icons/get-device-type-icon'

export interface SelectCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  type?: DeviceType
  icon?: React.ReactNode
  subtitle?: string
  selected?: boolean
  onSelect?: () => void
}

export function SelectCard({
  title,
  type,
  icon,
  subtitle,
  selected = false,
  onSelect,
  className,
  ...props
}: SelectCardProps) {
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
      <div className="relative shrink-0 size-6">
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
              "size-6",
              selected ? "text-[#ffc008]" : "text-[#888888]"
            )
          })
        )}
      </div>

      {/* Title and subtitle */}
      <div className="basis-0 content-stretch flex flex-col font-['DM_Sans'] font-medium grow items-start justify-center min-h-px min-w-px relative shrink-0">
        <p 
          className="leading-6 overflow-ellipsis overflow-hidden relative shrink-0 text-[18px] text-[#fafafa] w-full"
          style={{ fontVariationSettings: "'opsz' 14" }}
        >
          {title}
        </p>

        {subtitle && (
          <p 
            className={cn(
              "leading-5 overflow-ellipsis overflow-hidden relative shrink-0 text-[14px] w-full",
              selected ? "text-[#ffc008]" : "text-[#888888]"
            )}
            style={{ fontVariationSettings: "'opsz' 14" }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Check icon for selected state */}
      {selected && (
        <div className="relative shrink-0 size-6">
          <CheckCircle className="size-6 text-[#ffc008]" />
        </div>
      )}
    </div>
  )
}