import React from 'react'

interface MsIconProps {
  width?: number | string
  height?: number | string
  className?: string
}

export function MicrosoftIcon({ 
  width = 24, 
  height = 24, 
  className = "text-current" 
  }: MsIconProps) {
  return (
    <svg 
      width={24}
      height={24}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <g>
        <path d="M11.5047 11.5032H2V2H11.5047V11.5032Z" fill="#F1511B"/>
        <path d="M22.0002 11.5032H12.4946V2H21.9993V11.5032H22.0002Z" fill="#80CC28"/>
        <path d="M11.5047 21.9993H2V12.4961H11.5047V21.9993Z" fill="#00ADEF"/>
        <path d="M22.0002 21.9993H12.4946V12.4961H21.9993V21.9993H22.0002Z" fill="#FBBC09"/>
      </g>
    </svg>
  )
}