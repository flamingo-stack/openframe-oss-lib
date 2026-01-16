import type { SVGProps } from "react";
export interface Numer9SquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer9SquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer9SquareIconProps) {
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
        d="M13.125 10.25a1.125 1.125 0 0 0-2.25 0v.25a1.125 1.125 0 0 0 2.25 0zm-3.756 3.77a1.125 1.125 0 0 1 1.562.3l-1.862 1.264a1.126 1.126 0 0 1 .3-1.563Zm6.006-.27A3.383 3.383 0 0 1 12 17.124a3.59 3.59 0 0 1-2.931-1.541l.931-.632.93-.633c.218.32.642.555 1.07.555.62 0 1.125-.514 1.125-1.125v-.071a3.4 3.4 0 0 1-1.125.197A3.375 3.375 0 0 1 8.625 10.5v-.251a3.375 3.375 0 1 1 6.75 0z"
      />
    </svg>
  );
}
