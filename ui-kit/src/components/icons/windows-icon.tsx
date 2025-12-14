import React from "react"

export interface WindowsIconProps extends React.SVGProps<SVGSVGElement> {}

export function WindowsIcon({ className, color = 'white', ...props }: WindowsIconProps) {
  return (
    <svg 
      width="16" 
      height="16" 
      viewBox="0 0 16 16" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path d="M0.833374 2.22562L6.28233 1.48656L6.28468 6.72147L0.838322 6.75234L0.833374 2.22567V2.22562ZM6.27973 7.32457L6.2839 12.564L0.837593 11.8182L0.83728 7.28945L6.27973 7.32457ZM6.94025 1.38981L14.165 0.3396V6.65486L6.94025 6.71192V1.38981ZM14.1667 7.37385L14.165 13.6606L6.9402 12.645L6.93009 7.36207L14.1667 7.37385Z" fill={color}/>
    </svg>
  )
}