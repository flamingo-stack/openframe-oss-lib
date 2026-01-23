import type { SVGProps } from "react";
export interface MapSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MapSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MapSquareIconProps) {
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
        d="M14.216 2.616a1.125 1.125 0 1 1 2.114.768l-3.142 8.637 8.216 3.16.105.046a1.126 1.126 0 0 1-.804 2.09l-.11-.036-8.176-3.145-2.634 7.248a1.126 1.126 0 0 1-2.115-.768z"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.035-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.036.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
