import React from "react"

export interface MingoIconProps extends React.SVGProps<SVGSVGElement> {
  color?: string;
}

export function MingoIcon({ className, color = 'white', ...props }: MingoIconProps) {
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
      <circle cx="8.875" cy="12" r="1.25" fill={color} />
      <circle cx="15.125" cy="12" r="1.25" fill={color} />
      <path d="M2 8.25V15.75C2 17.8211 3.67893 19.5 5.75 19.5H14.5V17H5.75C5.05964 17 4.5 16.4404 4.5 15.75V8.25C4.5 7.55964 5.05964 7 5.75 7H18.25C18.9404 7 19.5 7.55964 19.5 8.25V12H22V8.25C22 6.17893 20.3211 4.5 18.25 4.5H5.75C3.67893 4.5 2 6.17893 2 8.25Z" fill={color} />
      <path d="M17 19.5V17H19.5V14.5H22V19.5H17Z" fill={color} />
    </svg>
  )
}
