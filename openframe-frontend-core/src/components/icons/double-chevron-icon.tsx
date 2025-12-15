import React from 'react'
import { cn } from '../../utils/cn'

type DoubleChevronDirection = 'left' | 'right' | 'up' | 'down'

interface DoubleChevronIconProps {
  className?: string
  size?: number
  direction?: DoubleChevronDirection
  color?: string
}

const rotationMap: Record<DoubleChevronDirection, string> = {
  left: 'rotate-0',
  right: 'rotate-180',
  up: 'rotate-90',
  down: '-rotate-90'
}

export function DoubleChevronIcon({ 
  className = '', 
  size = 20, 
  direction = 'left',
  color = '#888888'
}: DoubleChevronIconProps) {
  return (
    <svg 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn(
        'transition-transform duration-200',
        rotationMap[direction],
        className
      )}
      style={{ width: size, height: size }}
    >
      <path d="M18.2046 18.7956C18.6439 19.2349 19.3561 19.2349 19.7954 18.7956C20.2348 18.3562 20.2348 17.6441 19.7954 17.2048L14.5908 12.0002L19.7954 6.79558L19.873 6.71062C20.2335 6.26875 20.2073 5.61667 19.7954 5.20476C19.3835 4.79286 18.7314 4.76667 18.2896 5.12713L18.2046 5.20476L12.2046 11.2048C11.9936 11.4157 11.875 11.7018 11.875 12.0002C11.875 12.2985 11.9936 12.5846 12.2046 12.7956L18.2046 18.7956Z" fill={color} />
      <path d="M10.2046 18.7956C10.6439 19.2349 11.3561 19.2349 11.7954 18.7956C12.2347 18.3562 12.2347 17.6441 11.7954 17.2048L6.59082 12.0002L11.7954 6.79558L11.873 6.71062C12.2335 6.26875 12.2073 5.61667 11.7954 5.20476C11.3835 4.79286 10.7314 4.76667 10.2896 5.12713L10.2046 5.20476L4.20459 11.2048C3.99361 11.4157 3.875 11.7018 3.875 12.0002C3.875 12.2985 3.99361 12.5846 4.20459 12.7956L10.2046 18.7956Z" fill={color} />
    </svg>
  )
}