import type { SVGProps } from "react";
export interface ChartBar02VrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBar02VrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChartBar02VrIconProps) {
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
        d="M18.525 19.875h1.35V4.125h-1.35zm3.6.125c0 1.1-.836 2.006-1.908 2.115l-.217.01h-1.6A2.126 2.126 0 0 1 16.276 20V4c0-1.173.952-2.125 2.126-2.125H20c1.173 0 2.125.952 2.125 2.125zm-10.8-.125h1.35V8.125h-1.35zm-7.2 0h1.35v-7.75h-1.35zm3.6.125c0 1.1-.837 2.006-1.908 2.114l-.217.01H4a2.125 2.125 0 0 1-2.125-2.123v-8.002c0-1.173.952-2.124 2.125-2.124h1.6c1.174 0 2.125.951 2.126 2.124zm7.2 0a2.125 2.125 0 0 1-2.125 2.125h-1.6A2.125 2.125 0 0 1 9.075 20V8c0-1.173.952-2.125 2.125-2.125h1.6c1.173 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
