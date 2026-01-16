import type { SVGProps } from "react";
export interface MoonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MoonIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MoonIconProps) {
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
        d="M9.375 6.696c0-1.157.182-2.273.519-3.32a8.875 8.875 0 1 0 9.11 14.073c-5.415-.593-9.629-5.18-9.629-10.753m2.25 0a8.57 8.57 0 0 0 9.285 8.541 1.127 1.127 0 0 1 1.104 1.613 11.13 11.13 0 0 1-10.013 6.274C5.856 23.124.875 18.144.875 12 .875 5.964 5.682 1.05 11.677.88a1.126 1.126 0 0 1 1.016 1.669 8.5 8.5 0 0 0-1.067 4.147Z"
      />
    </svg>
  );
}
