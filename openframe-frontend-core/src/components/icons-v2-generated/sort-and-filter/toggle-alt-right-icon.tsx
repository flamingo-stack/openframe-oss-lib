import type { SVGProps } from "react";
export interface ToggleAltRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ToggleAltRightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ToggleAltRightIconProps) {
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
        d="M20.875 12a4.875 4.875 0 0 0-4.876-4.875H8a4.875 4.875 0 1 0 0 9.75h8A4.875 4.875 0 0 0 20.874 12Zm2.25 0a7.125 7.125 0 0 1-7.126 7.125H8a7.125 7.125 0 0 1 0-14.25h8A7.125 7.125 0 0 1 23.124 12Z"
      />
      <path
        fill={color}
        d="M17.375 12a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0"
      />
    </svg>
  );
}
