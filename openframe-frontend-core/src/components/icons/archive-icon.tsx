import React from "react"

export interface ArchiveIconProps extends React.SVGProps<SVGSVGElement> {
  color?: string;
}

export function ArchiveIcon({ className = "h-6 w-6", color = 'white', ...props }: ArchiveIconProps) {
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
        d="M20.54 5.23L19.15 3.55C18.88 3.21 18.47 3 18 3H6C5.53 3 5.12 3.21 4.84 3.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19C3 20.1 3.9 21 5 21H19C20.1 21 21 20.1 21 19V6.5C21 6.02 20.83 5.57 20.54 5.23ZM6.24 5H17.76L18.57 6H5.44L6.24 5ZM5 19V8H19V19H5ZM9.5 10V12H14.5V10H16V12C16 12.55 15.55 13 15 13H9C8.45 13 8 12.55 8 12V10H9.5Z"
        fill={color}
      />
    </svg>
  )
}