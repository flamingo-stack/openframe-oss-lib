import React from "react"

export interface BotIconProps extends React.SVGProps<SVGSVGElement> {
  color?: string;
}

export function BotIcon({ className = "h-6 w-6", color = 'white', ...props }: BotIconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M12 8V4M8 8V12C8 13.1046 8.89543 14 10 14H14C15.1046 14 16 13.1046 16 12V8H8Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 2C10.8954 2 10 2.89543 10 4C10 5.10457 10.8954 6 12 6C13.1046 6 14 5.10457 14 4C14 2.89543 13.1046 2 12 2Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 8H4C2.89543 8 2 8.89543 2 10V12C2 13.1046 2.89543 14 4 14H8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 8H20C21.1046 8 22 8.89543 22 10V12C22 13.1046 21.1046 14 20 14H16"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 14V16C9 17.1046 9.89543 18 11 18H13C14.1046 18 15 17.1046 15 16V14"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 18V20C9 21.1046 9.89543 22 11 22H13C14.1046 22 15 21.1046 15 20V18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10.5" r="0.5" fill={color} />
      <circle cx="14" cy="10.5" r="0.5" fill={color} />
    </svg>
  )
}