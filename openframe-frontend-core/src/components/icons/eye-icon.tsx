import React from 'react'

interface EyeIconProps {
  className?: string
  size?: number
  color?: string
  off?: boolean // when true show eye-off
}

export const EyeIcon: React.FC<EyeIconProps> = ({ className = '', size = 24, color = 'white', off = false }) => {
  if (off) {
    // eye-off
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className={className}>
        <path d="M3 3l18 18" />
        <path d="M10.584 10.587a2 2 0 102.829 2.829" />
        <path d="M16.681 16.681A8.979 8.979 0 0012 18c-5 0-9-6-9-6a15.648 15.648 0 013.555-3.873" />
        <path d="M9.878 4.592A9.04 9.04 0 0112 4c5 0 9 6 9 6a15.64 15.64 0 01-2.24 2.78" />
      </svg>
    )
  }
  // eye
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" className={className}>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}