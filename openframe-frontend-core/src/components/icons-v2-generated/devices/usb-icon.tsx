import type { SVGProps } from "react";
export interface UsbIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UsbIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UsbIconProps) {
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
        d="M16.875 9.17V4A.875.875 0 0 0 16 3.125H8A.875.875 0 0 0 7.125 4v5.17a1.125 1.125 0 0 1-2.25 0V4A3.125 3.125 0 0 1 8 .875h8A3.125 3.125 0 0 1 19.125 4v5.17a1.125 1.125 0 0 1-2.25 0m-8-3.17V5a1.125 1.125 0 0 1 2.25 0v1a1.126 1.126 0 0 1-2.25 0m4 0V5a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M18.875 12c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v7c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 7A4.126 4.126 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19v-7A4.125 4.125 0 0 1 7 7.875h10A4.125 4.125 0 0 1 21.125 12z"
      />
    </svg>
  );
}
