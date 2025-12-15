import React from 'react'

export interface BashIconProps {
  size?: number
  className?: string
  color?: string
}

export const BashIcon: React.FC<BashIconProps> = ({ size = 16, className = '' , color = 'white'}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      className={className}
      viewBox="0 0 24 24">
      <path fill={color}
        d="M5 9h2.31l.32-3h2l-.32 3h2l.32-3h2l-.32 3H15v2h-1.9l-.2 2H15v2h-2.31l-.32 3h-2l.32-3h-2l-.32 3h-2l.32-3H5v-2h1.9l.2-2H5zm4.1 2l-.2 2h2l.2-2M19 6h-2v8h2m0 2h-2v2h2Z" />
    </svg>
  )
}

BashIcon.displayName = 'BashIcon'
