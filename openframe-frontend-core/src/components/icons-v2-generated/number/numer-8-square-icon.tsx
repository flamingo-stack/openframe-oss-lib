import type { SVGProps } from "react";
export interface Numer8SquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer8SquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer8SquareIconProps) {
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
        d="M13.125 13.75a1.125 1.125 0 1 0-2.25 0 1.125 1.125 0 0 0 2.25 0m-.45-4a.626.626 0 0 0-.625-.625h-.1a.626.626 0 0 0 0 1.25h.1c.345 0 .625-.28.625-.625m2.25 0a2.86 2.86 0 0 1-.515 1.64 3.375 3.375 0 1 1-4.82 0 2.876 2.876 0 0 1 2.36-4.515h.1a2.876 2.876 0 0 1 2.875 2.875"
      />
    </svg>
  );
}
