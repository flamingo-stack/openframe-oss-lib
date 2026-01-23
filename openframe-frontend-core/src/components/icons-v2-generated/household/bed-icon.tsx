import type { SVGProps } from "react";
export interface BedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BedIconProps) {
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
        d="M20.875 18v-3A2.875 2.875 0 0 0 18 12.126H2a1.125 1.125 0 0 1 0-2.25h16a5.125 5.125 0 0 1 5.125 5.126v3a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M20.875 21v-1.875H3.125V21a1.125 1.125 0 0 1-2.25 0V7a1.125 1.125 0 0 1 2.25 0v8.876H22c.62 0 1.125.503 1.125 1.124v4a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
