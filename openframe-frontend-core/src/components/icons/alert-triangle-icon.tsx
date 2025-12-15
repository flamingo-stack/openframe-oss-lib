import React from "react"

export interface AlertTriangleIconProps extends React.SVGProps<SVGSVGElement> { }

export function AlertTriangleIcon({ className = "h-6 w-6", color = 'white', ...props }: AlertTriangleIconProps) {
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
        d="M10.29 3.86L1.82 18C1.64571 18.3024 1.55299 18.6453 1.55201 18.9945C1.55103 19.3437 1.64180 19.6871 1.81439 19.9905C1.98699 20.2939 2.23289 20.5467 2.52814 20.7239C2.82339 20.9010 3.15932 20.9956 3.50204 21H20.4892C20.8319 20.9956 21.1679 20.9010 21.4631 20.7239C21.7584 20.5467 22.0043 20.2939 22.1769 19.9905C22.3495 19.6871 22.4402 19.3437 22.4392 18.9945C22.4382 18.6453 22.3455 18.3024 22.1712 18L13.7012 3.86C13.5218 3.56611 13.2732 3.32312 12.9764 3.15133C12.6796 2.97955 12.3437 2.88440 12.0012 2.88440C11.6588 2.88440 11.3229 2.97955 11.0261 3.15133C10.7293 3.32312 10.4807 3.56611 10.3012 3.86H10.29Z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 9V13"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 17H12.01"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}