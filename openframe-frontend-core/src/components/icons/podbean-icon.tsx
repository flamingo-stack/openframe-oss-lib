import React from 'react';

interface PodbeanIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Podbean brand icon
 * Features a podcast/wifi wave pattern with 2 arcs and a center circle
 * Default color is 'currentColor' for easy styling
 */
/** @deprecated Use icons from icons-v2-generated instead. */
export function PodbeanIcon({
  className = '',
  size = 24,
  color = 'currentColor',
  ...props
}: PodbeanIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Outer arc - centered vertically */}
      <path
        d="M3 10a12 12 0 0 1 18 0"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Inner arc */}
      <path
        d="M7 14a7 7 0 0 1 10 0"
        stroke={color}
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      {/* Center circle */}
      <circle cx="12" cy="19" r="2.5" fill={color} />
    </svg>
  );
}
