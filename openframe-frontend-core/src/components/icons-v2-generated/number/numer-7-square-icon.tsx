import type { SVGProps } from "react";
export interface Numer7SquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer7SquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Numer7SquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M10.376 16c0-2.605 1.055-4.912 2.13-6.875H9.75a1.125 1.125 0 0 1 0-2.25H14c1.062 0 1.714 1.147 1.193 2.058-1.318 2.304-2.567 4.551-2.567 7.066a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
