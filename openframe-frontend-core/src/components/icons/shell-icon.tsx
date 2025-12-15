import React from 'react'

export function ShellIcon({ className = "w-5 h-5", size = 22, color = 'white' }: { className?: string; size?: number; color?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48" >
      <path
        fill='transparent'
        stroke={color}
        d="M6.5 8.4a2 2 0 0 0-2 2v27.2a2 2 0 0 0 2 2h35a2 2 0 0 0 2-2V10.4a2 2 0 0 0-2-2zM9 23.16l7.72 6L9 35.13v-12zm20.46 11.97h-11" />
    </svg >
  )
}
