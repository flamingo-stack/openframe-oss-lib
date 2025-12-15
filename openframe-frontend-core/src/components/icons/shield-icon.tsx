import React from "react"

export interface ShieldIconProps extends React.SVGProps<SVGSVGElement> { }

export function ShieldIcon({ className = "h-6 w-6", color = 'white', ...props }: ShieldIconProps) {
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
        d="M12 22S2 17 2 9V4L12 2L22 4V9C22 17 12 22 12 22Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9 12L10.5 13.5L16 8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}