import type { SVGProps } from "react";
export interface SmokingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SmokingIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SmokingIconProps) {
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
        d="M7.875 17v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m13 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m0-8v-.5c0-.759-.616-1.375-1.375-1.375A3.626 3.626 0 0 1 15.874 3.5V3a1.125 1.125 0 0 1 2.25 0v.5c0 .759.617 1.375 1.376 1.375A3.626 3.626 0 0 1 23.125 8.5V9a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19 11.875c.62 0 1.125.504 1.125 1.125v4c0 .622-.504 1.125-1.125 1.125H3A2.126 2.126 0 0 1 .875 16v-2c0-1.173.952-2.125 2.125-2.125zm-15.875 4h14.75v-1.75H3.125z"
      />
    </svg>
  );
}
