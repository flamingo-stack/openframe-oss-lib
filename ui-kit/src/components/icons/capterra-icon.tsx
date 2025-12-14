import React from 'react';

interface CapterraIconProps {
  width?: number | string;
  height?: number | string;
  className?: string;
  firstColor?: string;
  secondColor?: string;
  thirdColor?: string;
  fourthColor?: string;
}

export function CapterraIcon({
  width = 2500,
  height = 2500,
  className = '',
  firstColor = '#ff9d28',
  secondColor = '#68c5ed',
  thirdColor = '#044d80',
  fourthColor = '#e54747',
}: CapterraIconProps) {
  return (
    <svg height={height} width={width} className={className}
      xmlns="http://www.w3.org/2000/svg" viewBox="4.978 2.022 320.044 325.956">
      <path d="M4.978 121.868l135.18.027 82.2.014V40.475z" fill={firstColor} />
      <path d="M222.357 40.475v287.503L325.022 2.022z" fill={secondColor} />
      <path d="M222.357 121.909l-82.199-.014 82.2 206.083z" fill={thirdColor} />
      <path d="M4.978 121.868l156.26 52.905-21.08-52.878-135.18-.027z" fill={fourthColor} />
    </svg>
  );
}
