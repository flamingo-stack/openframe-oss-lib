import React from 'react';

interface MarginCrisisIconProps {
  className?: string;
  width?: number | string;
  height?: number | string;
  strokeColor?: string;
}

export const MarginCrisisIcon: React.FC<MarginCrisisIconProps> = ({
  className = '',
  width = 148,
  height = 148,
  strokeColor = '#F357BB'
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 148 148" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path 
        d="M24.6667 129.5C21.2609 129.5 18.5 126.739 18.5 123.333L18.5 24.6667C18.5 21.261 21.2609 18.5001 24.6667 18.5001L34.5333 18.5001C37.9391 18.5001 40.7 21.261 40.7 24.6667L40.7 123.333C40.7 126.739 37.9391 129.5 34.5333 129.5H24.6667Z" 
        stroke={strokeColor}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M69.0664 129.5C65.6606 129.5 62.8997 126.739 62.8997 123.333L62.8997 49.3334C62.8997 45.9276 65.6606 43.1667 69.0664 43.1667H78.933C82.3388 43.1667 85.0997 45.9276 85.0997 49.3334V123.333C85.0997 126.739 82.3388 129.5 78.933 129.5H69.0664Z" 
        stroke={strokeColor}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M113.467 129.5C110.061 129.5 107.3 126.739 107.3 123.333V74C107.3 70.5943 110.061 67.8334 113.467 67.8334H123.333C126.739 67.8334 129.5 70.5943 129.5 74V123.333C129.5 126.739 126.739 129.5 123.333 129.5H113.467Z" 
        stroke={strokeColor}
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
    </svg>
  );
};