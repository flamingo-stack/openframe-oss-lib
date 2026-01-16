import type { SVGProps } from "react";
export interface AlphabetKSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetKSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetKSquareIconProps) {
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
        d="M8.625 16V8a1.125 1.125 0 0 1 2.25 0v1.94l2.268-2.668a1.126 1.126 0 0 1 1.715 1.456l-2.376 2.793 3.132 3.76a1.124 1.124 0 1 1-1.729 1.44l-2.881-3.46-.129.152v2.586a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
