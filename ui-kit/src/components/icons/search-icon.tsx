import React from 'react';

interface SearchIconProps {
  color?: string;
  width?: number;
  height?: number;
  className?: string;
}

export function SearchIcon({
  width = 22,
  height = 22,
  className = '',
  color = '#888888'
}: SearchIconProps) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 22 22"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M5.54774 14.8613C5.98708 14.422 6.69924 14.422 7.13856 14.8613C7.57782 15.3007 7.57782 16.0128 7.13856 16.4521L2.7953 20.7954C2.35597 21.2347 1.6438 21.2347 1.20448 20.7954C0.765155 20.3561 0.765194 19.6439 1.20448 19.2046L5.54774 14.8613Z"
        fill={color}
      />
      <path
        d="M18.8754 9.99951C18.8751 6.20278 15.7962 3.125 11.9994 3.125C8.20283 3.12526 5.12515 6.20294 5.12489 9.99951C5.12489 13.7963 8.20266 16.8752 11.9994 16.8755C15.7964 16.8755 18.8754 13.7965 18.8754 9.99951ZM21.1254 9.99951C21.1254 15.0391 17.039 19.1255 11.9994 19.1255C6.96002 19.1252 2.87489 15.0389 2.87489 9.99951C2.87515 4.9603 6.96019 0.875264 11.9994 0.875C17.0388 0.875 21.1251 4.96014 21.1254 9.99951Z"
        fill={color}
      />
    </svg>
  );
}
