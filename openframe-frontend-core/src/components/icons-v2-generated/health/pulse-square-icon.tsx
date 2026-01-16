import type { SVGProps } from "react";
export interface PulseSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PulseSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PulseSquareIconProps) {
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
        d="M14.026 7.375c.474.01.891.319 1.041.769l1.244 3.731H21a1.125 1.125 0 0 1 0 2.25h-5.5c-.484 0-.914-.31-1.067-.769l-.51-1.526-1.374 3.574a1.124 1.124 0 0 1-2.055.1l-1.245-2.49-.243.488c-.19.382-.58.623-1.006.623H3a1.125 1.125 0 0 1 0-2.25h4.305l.94-1.878.08-.136a1.126 1.126 0 0 1 1.932.136l1.109 2.218 1.585-4.12.074-.158a1.13 1.13 0 0 1 1-.562Z"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
