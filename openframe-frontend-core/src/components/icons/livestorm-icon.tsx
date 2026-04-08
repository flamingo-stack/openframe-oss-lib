import React from 'react';

interface LivestormIconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
  size?: number;
  color?: string;
}

/**
 * Livestorm brand icon
 * Features 3 horizontal bars and a dot representing the Livestorm logo
 * Default color is 'currentColor' for easy styling
 */
/** @deprecated Use icons from icons-v2-generated instead. */
export function LivestormIcon({
  className = '',
  size = 24,
  color = 'currentColor',
  ...props
}: LivestormIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 140 140"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...props}
    >
      {/* Top bar */}
      <path
        d="M77.8862 33.4062H33.1121C29.1518 33.4062 25.9414 36.6167 25.9414 40.577C25.9414 44.5372 29.1518 47.7477 33.1121 47.7477H77.8862C81.8464 47.7477 85.0569 44.5372 85.0569 40.577C85.0569 36.6167 81.8464 33.4062 77.8862 33.4062Z"
        fill={color}
      />
      {/* Middle bar */}
      <path
        d="M92.5463 62.8232H47.7723C43.812 62.8232 40.6016 66.0337 40.6016 69.9939C40.6016 73.9542 43.812 77.1646 47.7723 77.1646H92.5463C96.5066 77.1646 99.717 73.9542 99.717 69.9939C99.717 66.0337 96.5066 62.8232 92.5463 62.8232Z"
        fill={color}
      />
      {/* Bottom bar */}
      <path
        d="M77.8874 92.2522H62.4324C58.4722 92.2522 55.2617 95.4626 55.2617 99.4229C55.2617 103.383 58.4722 106.594 62.4324 106.594H77.8874C81.8476 106.594 85.0581 103.383 85.0581 99.4229C85.0581 95.4626 81.8476 92.2522 77.8874 92.2522Z"
        fill={color}
      />
      {/* Dot */}
      <path
        d="M114.058 40.577C114.058 36.6167 110.848 33.4062 106.887 33.4062C102.927 33.4062 99.7168 36.6167 99.7168 40.577C99.7168 44.5372 102.927 47.7477 106.887 47.7477C110.848 47.7477 114.058 44.5372 114.058 40.577Z"
        fill={color}
      />
    </svg>
  );
}
