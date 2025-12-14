import React from 'react'

interface PlusCircleIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  whiteOverlay?: boolean
  iconSize?: number
}

export function PlusCircleIcon({ className, whiteOverlay = false, iconSize = 24, ...props }: PlusCircleIconProps) {
  return (
    <svg 
      width={iconSize} 
      height={iconSize} 
      viewBox="0 0 24 24"
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path 
        d="M20.8745 12.0005C20.8745 7.09912 16.9018 3.12526 12.0005 3.125C7.09896 3.125 3.125 7.09896 3.125 12.0005C3.12526 16.9018 7.09912 20.8745 12.0005 20.8745C16.9016 20.8742 20.8742 16.9016 20.8745 12.0005ZM23.1245 12.0005C23.1242 18.1443 18.1443 23.1242 12.0005 23.1245C5.85648 23.1245 0.875264 18.1444 0.875 12.0005C0.875 5.85632 5.85632 0.875 12.0005 0.875C18.1444 0.875264 23.1245 5.85648 23.1245 12.0005Z" 
        fill={whiteOverlay ? "white" : "#5EA62E"}
      />
      <path 
        d="M10.8755 15.9995V13.1255H8C7.37884 13.1255 6.87526 12.6216 6.875 12.0005C6.875 11.3792 7.37868 10.8755 8 10.8755H10.8755V8C10.8755 7.37868 11.3792 6.875 12.0005 6.875C12.6216 6.87526 13.1255 7.37884 13.1255 8V10.8755H15.9995L16.1152 10.8813C16.6824 10.9391 17.1245 11.4181 17.1245 12.0005C17.1243 12.5827 16.6823 13.062 16.1152 13.1196L15.9995 13.1255H13.1255V15.9995C13.1255 16.6207 12.6216 17.1242 12.0005 17.1245C11.3792 17.1245 10.8755 16.6208 10.8755 15.9995Z" 
        fill={whiteOverlay ? "white" : "#5EA62E"}
      />
    </svg>
  )
} 