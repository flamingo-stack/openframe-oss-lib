import type { SVGProps } from "react";
export interface KeyholeSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function KeyholeSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: KeyholeSquareIconProps) {
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
        d="M12.876 10a.876.876 0 1 0-1.752.002.876.876 0 0 0 1.752-.002m2.25 0a3.12 3.12 0 0 1-2.002 2.913V16a1.125 1.125 0 0 1-2.25 0v-3.087A3.123 3.123 0 0 1 12 6.875 3.126 3.126 0 0 1 15.127 10Z"
      />
    </svg>
  );
}
