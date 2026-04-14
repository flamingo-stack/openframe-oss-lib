import React from 'react'

interface ClickUpIconProps {
  width?: number | string
  height?: number | string
  className?: string
}

export function ClickUpIcon({
  width = 24,
  height = 24,
  className = '',
}: ClickUpIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 54.8 65.8"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="clickup-grad-1" gradientUnits="userSpaceOnUse" x1="0" y1="15.0492" x2="54.8446" y2="15.0492" gradientTransform="matrix(1 0 0 -1 0 69.3604)">
          <stop offset="0" stopColor="#8930FD" />
          <stop offset="1" stopColor="#49CCF9" />
        </linearGradient>
        <linearGradient id="clickup-grad-2" gradientUnits="userSpaceOnUse" x1="1.1953" y1="53.166" x2="53.7447" y2="53.166" gradientTransform="matrix(1 0 0 -1 0 69.3604)">
          <stop offset="0" stopColor="#FF02F0" />
          <stop offset="1" stopColor="#FFC800" />
        </linearGradient>
      </defs>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M0,50.6l10.1-7.8c5.4,7,11.1,10.3,17.4,10.3c6.3,0,11.9-3.2,17-10.2l10.3,7.6c-7.4,10-16.6,15.3-27.3,15.3 C16.9,65.8,7.6,60.5,0,50.6z"
        fill="url(#clickup-grad-1)"
      />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M27.5,16.9l-18,15.5l-8.3-9.7L27.6,0l26.2,22.7l-8.4,9.6L27.5,16.9z"
        fill="url(#clickup-grad-2)"
      />
    </svg>
  )
}
