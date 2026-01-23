import type { SVGProps } from "react";
export interface ChartBar03VerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBar03VerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartBar03VerIconProps) {
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
        d="M11.325 19.875h1.35V4.125h-1.35zm3.6.125a2.126 2.126 0 0 1-2.125 2.125h-1.6A2.126 2.126 0 0 1 9.075 20V4c0-1.173.952-2.125 2.125-2.125h1.6c1.174 0 2.125.952 2.125 2.125zm3.599-.125h1.351v-7.75h-1.35zm-14.399 0h1.35V8.125h-1.35zm18 .125A2.125 2.125 0 0 1 20 22.125h-1.6A2.125 2.125 0 0 1 16.274 20v-8c0-1.174.953-2.124 2.126-2.125H20c1.173 0 2.125.951 2.125 2.124zm-14.4 0A2.125 2.125 0 0 1 5.6 22.125H4A2.125 2.125 0 0 1 1.875 20V8c0-1.173.952-2.125 2.125-2.125h1.6c1.174 0 2.126.952 2.126 2.125z"
      />
    </svg>
  );
}
