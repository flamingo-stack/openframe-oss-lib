import React from 'react';

interface LumaIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
}

export function LumaIcon({ className = '', size = 24, color = 'white', ...props }: LumaIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 133 134"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      <path
        d="M133 67C96.282 67 66.5 36.994 66.5 0c0 36.994-29.782 67-66.5 67 36.718 0 66.5 30.006 66.5 67 0-36.994 29.782-67 66.5-67"
        fill={color}></path>
    </svg>
  );
}