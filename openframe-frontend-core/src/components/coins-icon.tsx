import React from 'react';

interface CoinsIconProps {
  className?: string;
  width?: number;
  height?: number;
}

export const CoinsIcon: React.FC<CoinsIconProps> = ({ 
  className = "", 
  width = 20, 
  height = 20 
}) => {
  return (
    <svg 
      width={width} 
      height={height} 
      viewBox="0 0 20 20" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="7" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <circle cx="13" cy="12" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M9 6c0-1.1.9-2 2-2s2 .9 2 2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
      <path d="M15 10c0-1.1.9-2 2-2s2 .9 2 2" stroke="currentColor" strokeWidth="1.5" fill="none"/>
    </svg>
  );
}; 