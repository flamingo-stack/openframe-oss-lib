import React from 'react'

interface ShieldCheckIconProps {
  className?: string
  size?: number
  color?: string
  strokeWidth?: number
}

export function ShieldCheckIcon({
  className = '',
  size = 24,
  color = 'white',
  strokeWidth = 1.5
}: ShieldCheckIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      strokeWidth={strokeWidth}
    >
      <path
        d="M12 2L4 7V11C4 15.55 6.84 19.74 11 20.92C15.16 19.74 20 15.55 20 11V7L12 2Z"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M9 12L11 14L15 10"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}