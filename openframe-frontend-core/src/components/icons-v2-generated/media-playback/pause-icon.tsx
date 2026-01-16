import type { SVGProps } from "react";
export interface PauseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PauseIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PauseIconProps) {
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
        d="M7.875 6A.875.875 0 0 0 7 5.125H5A.875.875 0 0 0 4.125 6v12c0 .483.391.875.875.875h2A.876.876 0 0 0 7.875 18zm12 0A.875.875 0 0 0 19 5.125h-2a.875.875 0 0 0-.875.875v12c0 .483.392.875.875.875h2a.876.876 0 0 0 .875-.875zm-9.75 12A3.126 3.126 0 0 1 7 21.125H5A3.126 3.126 0 0 1 1.875 18V6A3.125 3.125 0 0 1 5 2.875h2A3.125 3.125 0 0 1 10.125 6zm12 0A3.126 3.126 0 0 1 19 21.125h-2A3.126 3.126 0 0 1 13.875 18V6A3.125 3.125 0 0 1 17 2.875h2A3.125 3.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
