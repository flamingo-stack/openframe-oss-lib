import React from 'react'

export interface DevicesIconProps extends React.SVGProps<SVGSVGElement> {
  size?: number
  color?: string
}

export function DevicesIcon({ className = '', size = 20, color, style, ...rest }: DevicesIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={color}
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      {...rest}
    >
      <path d="M10.8755 17C10.8755 16.3787 11.3792 15.875 12.0005 15.875C12.6216 15.8753 13.1255 16.3788 13.1255 17V19.8755H15.9995L16.1152 19.8813C16.6824 19.9391 17.1245 20.4181 17.1245 21.0005C17.1243 21.5827 16.6823 22.062 16.1152 22.1196L15.9995 22.1255H8C7.37884 22.1255 6.87526 21.6216 6.875 21.0005C6.875 20.3792 7.37868 19.8755 8 19.8755H10.8755V17Z" />
      <path d="M20.8745 6C20.8745 4.96447 20.035 4.125 18.9995 4.125H5C3.96447 4.125 3.125 4.96447 3.125 6V13.9995C3.125 15.035 3.96447 15.8745 5 15.8745H18.9995C20.035 15.8745 20.8745 15.035 20.8745 13.9995V6ZM23.1245 13.9995C23.1245 16.2777 21.2777 18.1245 18.9995 18.1245H5C2.72183 18.1245 0.875 16.2777 0.875 13.9995V6C0.875 3.72183 2.72183 1.875 5 1.875H18.9995C21.2777 1.875 23.1245 3.72183 23.1245 6V13.9995Z" />
    </svg>
  )
}