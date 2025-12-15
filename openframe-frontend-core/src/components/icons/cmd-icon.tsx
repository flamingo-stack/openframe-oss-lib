import React from 'react'

export interface CmdIconProps {
  size?: number
  className?: string
  color?: string
}

export const CmdIcon: React.FC<CmdIconProps> = ({ size = 16, className = '', color='white'}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M3 4C3 3.44772 3.44772 3 4 3H20C20.5523 3 21 3.44772 21 4V20C21 20.5523 20.5523 21 20 21H4C3.44772 21 3 20.5523 3 20V4Z"
        stroke={color}
      />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fill={color}
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
      >
        \&gt;
      </text>
    </svg>
  )
}

CmdIcon.displayName = 'CmdIcon'
