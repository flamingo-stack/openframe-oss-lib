import * as React from 'react'
import { cn } from '../../utils/cn'

export interface FleetIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  color?: string
  className?: string
}

export const FleetIcon = React.forwardRef<SVGSVGElement, FleetIconProps>(
  ({ size = 16, className, color='white', ...props }, ref) => {
    return (
      <svg

        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 14 14"
        xmlns="http://www.w3.org/2000/svg"
        className={cn(className)}
        {...props}
      >
        <circle cx="2" cy="2" r="2" fill={color} />
        <circle cx="7" cy="2" r="2" fill={color} />
        <circle cx="12" cy="2" r="2" fill={color} />
        <circle cx="2" cy="7" r="2" fill={color} />
        <circle cx="7" cy="7" r="2" fill={color} />
        <circle cx="2" cy="12" r="2" fill={color} />
      </svg>
    )
  }
)