import type { SVGProps } from "react";
export interface Filter01ClockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter01ClockIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Filter01ClockIconProps) {
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
        d="M20.875 17a3.876 3.876 0 1 0-7.751.002A3.876 3.876 0 0 0 20.875 17m-5-2a1.125 1.125 0 0 1 2.25 0v1.12l1.148.29.11.031a1.126 1.126 0 0 1-.542 2.173l-.114-.022-2-.501A1.126 1.126 0 0 1 15.874 17zm7.25 2a6.126 6.126 0 1 1-12.25 0 6.126 6.126 0 0 1 12.25 0"
      />
      <path
        fill={color}
        d="M21.125 7.586c0 .494-.172.969-.482 1.347l-.14.155-.091.09a1.125 1.125 0 1 1-1.591-1.59l.054-.054V5A.875.875 0 0 0 18 4.125H4A.875.875 0 0 0 3.125 5v2.534l5.377 5.377.141.157c.31.378.482.853.482 1.346v3.582a1.125 1.125 0 0 1-2.25 0v-3.53L1.498 9.087a2.13 2.13 0 0 1-.623-1.502V5A3.125 3.125 0 0 1 4 1.875h14A3.125 3.125 0 0 1 21.125 5z"
      />
    </svg>
  );
}
