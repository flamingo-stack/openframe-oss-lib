import React from 'react';

interface TrustpilotIconProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  firstColor?: string;
  secondColor?: string;
}

export function TrustpilotIcon({
  width = 2500,
  height = 2500,
  className = '',
  firstColor = '#00b67a',
  secondColor = '#005128'
}: TrustpilotIconProps) {
  return (
    <svg width={width}
      className={className}
      height={height}
      viewBox="0 0 799.89 761"
      xmlns="http://www.w3.org/2000/svg" >
      <path d="M799.89 290.83H494.44L400.09 0l-94.64 290.83L0 290.54l247.37 179.92L152.72 761l247.37-179.63L647.16 761l-94.35-290.54z" fill={firstColor} />
      <path d="M574.04 536.24l-21.23-65.78-152.72 110.91z" fill={secondColor} />
    </svg>
  );
}
