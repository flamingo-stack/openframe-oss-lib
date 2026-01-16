import type { SVGProps } from "react";
export interface ChartBar01VerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBar01VerIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChartBar01VerIconProps) {
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
        d="M4.125 19.875h1.35V4.125h-1.35zm3.6.125A2.126 2.126 0 0 1 5.6 22.125H4A2.126 2.126 0 0 1 1.875 20V4c0-1.173.952-2.125 2.125-2.125h1.6c1.174 0 2.126.952 2.126 2.125zm10.8-.125h1.35v-7.75h-1.35zm-7.2 0h1.35V8.125h-1.35zm10.8.125A2.125 2.125 0 0 1 20 22.125h-1.6A2.125 2.125 0 0 1 16.275 20v-8c0-1.174.952-2.125 2.125-2.125H20c1.173 0 2.125.951 2.125 2.124zm-7.2 0c0 1.1-.837 2.006-1.908 2.114l-.217.01h-1.6a2.125 2.125 0 0 1-2.125-2.123V8c0-1.174.952-2.126 2.125-2.126h1.6c1.174 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
