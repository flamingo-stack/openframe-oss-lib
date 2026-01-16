import type { SVGProps } from "react";
export interface GraphBarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GraphBarIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GraphBarIconProps) {
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
        d="M1.875 18V3a1.125 1.125 0 0 1 2.25 0v15c0 1.035.84 1.875 1.875 1.875h15a1.125 1.125 0 0 1 0 2.25H6A4.125 4.125 0 0 1 1.875 18"
      />
      <path
        fill={color}
        d="M5.875 17v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m4 0V8a1.125 1.125 0 0 1 2.25 0v9a1.125 1.125 0 0 1-2.25 0m4 0v-6a1.125 1.125 0 0 1 2.25 0v6a1.125 1.125 0 0 1-2.25 0m4 0V5a1.125 1.125 0 0 1 2.25 0v12a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
