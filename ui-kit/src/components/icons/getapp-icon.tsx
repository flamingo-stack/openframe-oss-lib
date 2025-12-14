import React from 'react';

interface GetAppIconProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
  fifthColor?: string;
  sixthColor?: string;
}

export function GetAppIcon({
  width = 24,
  height = 24,
  className = '',
  firstColor = '#009C9C',
  secondColor = '#40E3E3',
  thirdColor = '#1ABAB8',
  fourthColor = '#87F0F0',
  fifthColor = '#17CFCF',
  sixthColor = '#424A52'
}: GetAppIconProps) {
  return (
    <svg
      version="1.1"
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
      viewBox="10 260 170 90"
      className={className}
    >
      <path fill={firstColor} d="M171,307.9l-40.5-40.5c-1.4-1.3-3.5-1.3-4.8,0l-8,8l32.5,32.5c1.3,1.3,1.3,3.5,0,4.8c0,0,0,0,0,0l-33.5,33.5
          l8,8c1.4,1.3,3.5,1.3,4.8,0l41.4-41.4C172.3,311.4,172.3,309.3,171,307.9"/>
      <path fill={secondColor} d="M102,270.4l-2.9-2.9c-1.4-1.3-3.5-1.3-4.8,0l-8,8l5.3,5.3l10.4,10.4l10.4-10.4L102,270.4z" />
      <path fill={secondColor} d="M101.1,330.6l-10.4,10.4l-5.3,5.3l8,8c1.4,1.3,3.5,1.3,4.8,0l2.9-2.9l10.4-10.4L101.1,330.6z" />
      <path fill={thirdColor} d="M118.9,307.9c1.3,1.4,1.3,3.5,0,4.8l-17.8,17.8l10.4,10.4l28.2-28.2c1.3-1.3,1.3-3.5,0-4.8c0,0,0,0,0,0
          l-27.2-27.2L102,291.1L118.9,307.9z"/>
      <path fill={fourthColor} d="M52.8,308.9L81,280.7l-10.4-10.4l-3-2.9c-1.4-1.3-3.5-1.3-4.8,0l-41.4,41.5c-1.3,1.3-1.3,3.5,0,4.8c0,0,0,0,0,0
          l40.5,40.5c1.4,1.3,3.5,1.3,4.8,0l3-2.9l10.4-10.4l-27.2-27.2C51.5,312.4,51.5,310.3,52.8,308.9C52.8,308.9,52.8,308.9,52.8,308.9"/>
      <path fill={fifthColor} d="M84.2,308.9l12.4-12.4l-10.4-10.4l-5.3-5.3L52.9,309c-1.3,1.3-1.3,3.5,0,4.8c0,0,0,0,0,0L80,340.9l5.3-5.3
          l10.4-10.4l-11.5-11.5C82.9,312.5,82.9,310.3,84.2,308.9"/>
      <path fill={sixthColor} d="M84.2,313.7l11.5,11.5l12.4-12.4c1.3-1.3,1.3-3.5,0-4.8c0,0,0,0,0,0l-11.5-11.5l-12.4,12.4
          C83,310.3,83,312.4,84.2,313.7"/>
    </svg>
  );
}
