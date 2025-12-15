import React from 'react'

interface MinusCircleIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
}

export function MinusCircleIcon({ className, ...props }: MinusCircleIconProps) {
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
        d="M20.8745 12.0005C20.8745 7.09912 16.9018 3.12526 12.0005 3.125C7.09896 3.125 3.125 7.09896 3.125 12.0005C3.12526 16.9018 7.09912 20.8745 12.0005 20.8745C16.9016 20.8742 20.8742 16.9016 20.8745 12.0005ZM23.1245 12.0005C23.1242 18.1443 18.1443 23.1242 12.0005 23.1245C5.85648 23.1245 0.875264 18.1444 0.875 12.0005C0.875 5.85632 5.85632 0.875 12.0005 0.875C18.1444 0.875264 23.1245 5.85648 23.1245 12.0005Z" 
        fill="#888888"
      />
      <path 
        d="M15.9995 10.875L16.1152 10.8809C16.6824 10.9386 17.1245 11.4176 17.1245 12C17.1245 12.5824 16.6824 13.0614 16.1152 13.1191L15.9995 13.125H8C7.37868 13.125 6.875 12.6213 6.875 12C6.875 11.3787 7.37868 10.875 8 10.875H15.9995Z" 
        fill="#888888"
      />
    </svg>
  )
} 