import type { SVGProps } from "react";
export interface AlphabetRSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetRSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetRSquareIconProps) {
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
        d="M13.375 10.25c0-.621-.504-1.125-1.125-1.125h-1.125v2.25h1.125c.621 0 1.125-.504 1.125-1.125m2.25 0a3.37 3.37 0 0 1-1.509 2.811l1.361 2.38.051.103a1.125 1.125 0 0 1-1.942 1.112l-.063-.098-1.676-2.933h-.722v2.374a1.125 1.125 0 0 1-2.25 0V8.25c0-.759.616-1.375 1.376-1.375h1.999a3.375 3.375 0 0 1 3.375 3.375"
      />
    </svg>
  );
}
