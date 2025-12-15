import React from 'react'

interface FolderShieldIconProps {
  className?: string
  size?: number
  color?: string
}

export const FolderShieldIcon: React.FC<FolderShieldIconProps> = ({
  className = '',
  size = 24,
  color = 'white'
}) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 65 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M13.6641 56H50.9974C55.4157 56 58.9974 52.4183 58.9974 48V24C58.9974 19.5817 55.4157 16 50.9974 16H36.102C35.3947 16 34.7164 15.719 34.2163 15.219L27.7784 8.78105C27.2783 8.28095 26.6001 8 25.8928 8H13.6641C9.24578 8 5.66406 11.5817 5.66406 16V48C5.66406 52.4183 9.24578 56 13.6641 56Z"
        stroke={color} />
      <path
        d="M40.9269 29.4715L32.9269 25.4715C32.5516 25.2838 32.1097 25.2838 31.7344 25.4715L23.7345 29.4715C23.2827 29.6973 22.9974 30.159 22.9974 30.6641L22.9975 36.3267C22.9974 41.2699 29.6997 45.3753 31.745 46.5131C32.1118 46.7172 32.5495 46.7172 32.9163 46.5131C34.9617 45.3754 41.6641 41.2699 41.6641 36.3267L41.6639 30.664C41.6639 30.159 41.3786 29.6973 40.9269 29.4715Z"
        stroke={color} />
    </svg>
  );
};