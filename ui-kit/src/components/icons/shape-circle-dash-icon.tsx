import React from 'react'

interface ShapeCircleDashIconProps {
  className?: string
  size?: number
  color?: string
  full?: boolean
}

export function ShapeCircleDashIcon({
  className = '',
  size = 24,
  color = 'white',
  full = false
}: ShapeCircleDashIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={full ? color : 'none'}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke={color}
        strokeWidth="1"
        strokeDasharray="4 2"
        strokeLinecap="round"
        fill={full ? color : 'none'}
      />
    </svg>
  )
}