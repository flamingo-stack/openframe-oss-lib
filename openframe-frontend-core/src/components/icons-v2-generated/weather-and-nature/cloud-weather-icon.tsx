import type { SVGProps } from "react";
export interface CloudWeatherIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CloudWeatherIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CloudWeatherIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      fill="none"
      viewBox="0 0 24 24"
      className={className}
      {...props}
    >
      <path
        fill={color}
        d="M20.875 14.5a3.38 3.38 0 0 0-2.278-3.192 1.125 1.125 0 0 1-.746-1.234 2.125 2.125 0 0 0-3.195-2.147 1.124 1.124 0 0 1-1.425-.223 4.626 4.626 0 0 0-8.067 3.656c.06.457-.164.903-.565 1.128A2.875 2.875 0 0 0 6 17.875h11.5a3.375 3.375 0 0 0 3.375-3.376Zm2.25 0a5.625 5.625 0 0 1-5.625 5.625H6a5.125 5.125 0 0 1-3.12-9.19q-.003-.091-.005-.186A6.876 6.876 0 0 1 9.75 3.875a6.85 6.85 0 0 1 4.568 1.74 4.374 4.374 0 0 1 5.8 3.905 5.62 5.62 0 0 1 3.007 4.98"
      />
    </svg>
  );
}
