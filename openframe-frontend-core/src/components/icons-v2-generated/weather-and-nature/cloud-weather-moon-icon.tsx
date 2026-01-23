import type { SVGProps } from "react";
export interface CloudWeatherMoonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CloudWeatherMoonIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CloudWeatherMoonIconProps) {
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
        d="M14.576 4.815q0-.67.123-1.308a4.88 4.88 0 0 0-2.42 6.75l-.998.522-.996.523A7.127 7.127 0 0 1 16.395.875a1.127 1.127 0 0 1 1.015 1.67 4.696 4.696 0 0 0 4.502 6.95 1.126 1.126 0 0 1 1.104 1.61 7.13 7.13 0 0 1-5.943 4.004 1.124 1.124 0 1 1-.146-2.244 4.85 4.85 0 0 0 2.99-1.295 6.944 6.944 0 0 1-5.341-6.755m-2.297 5.442a1.126 1.126 0 0 1-1.994 1.045z"
      />
      <path
        fill={color}
        d="M18.875 18a2.88 2.88 0 0 0-2.158-2.785 1.125 1.125 0 0 1-.843-1.136A1.88 1.88 0 0 0 14 12.125c-.425 0-.814.14-1.128.377a1.125 1.125 0 0 1-1.538-.173 3.375 3.375 0 0 0-5.918 2.704c.084.532-.22 1.05-.727 1.234a2.377 2.377 0 0 0 .81 4.608H16l.295-.015a2.876 2.876 0 0 0 2.58-2.86m2.25 0a5.125 5.125 0 0 1-4.862 5.118l-.264.007H5.5a4.625 4.625 0 0 1-2.374-8.593V14.5a5.625 5.625 0 0 1 9.256-4.295 4.12 4.12 0 0 1 5.68 3.101A5.13 5.13 0 0 1 21.126 18Z"
      />
    </svg>
  );
}
