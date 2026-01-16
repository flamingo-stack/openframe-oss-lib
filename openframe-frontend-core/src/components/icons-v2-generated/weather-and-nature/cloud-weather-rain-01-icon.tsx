import type { SVGProps } from "react";
export interface CloudWeatherRain01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CloudWeatherRain01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CloudWeatherRain01IconProps) {
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
        d="M19.875 10a2.88 2.88 0 0 0-2.158-2.785 1.125 1.125 0 0 1-.843-1.135l.001-.08a1.875 1.875 0 0 0-3.003-1.498 1.125 1.125 0 0 1-1.538-.173 3.375 3.375 0 0 0-5.918 2.704c.084.532-.22 1.05-.727 1.234a2.377 2.377 0 0 0 .81 4.608H17l.295-.015a2.876 2.876 0 0 0 2.58-2.86m2.25 0a5.125 5.125 0 0 1-4.862 5.118l-.264.007H6.5a4.625 4.625 0 0 1-2.374-8.593V6.5a5.625 5.625 0 0 1 9.256-4.295 4.12 4.12 0 0 1 5.68 3.101A5.13 5.13 0 0 1 22.126 10Zm-9.65 7.037a1.126 1.126 0 0 1 2.092.819l-1.5 4.5a1.125 1.125 0 1 1-2.134-.712l1.5-4.5zm3.958.107a1.125 1.125 0 1 1 2.134.712l-1.167 3.5a1.125 1.125 0 1 1-2.134-.712zm-8 0a1.126 1.126 0 0 1 2.135.712l-1 3-.043.107a1.126 1.126 0 0 1-2.092-.819zm-4 0a1.125 1.125 0 1 1 2.134.712l-.5 1.5a1.126 1.126 0 0 1-2.135-.712z"
      />
    </svg>
  );
}
