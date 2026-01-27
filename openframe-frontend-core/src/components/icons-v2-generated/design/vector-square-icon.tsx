import type { SVGProps } from "react";
export interface VectorSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function VectorSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: VectorSquareIconProps) {
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
        d="m17 6.125.116-.005a1.126 1.126 0 0 0 0-2.239L17 3.875H7a1.125 1.125 0 0 0 0 2.25zM3.875 7v10a1.125 1.125 0 0 0 2.25 0V7a1.125 1.125 0 0 0-2.25 0m14 0v10a1.126 1.126 0 0 0 2.25 0V7a1.125 1.125 0 0 0-2.25 0M17 20.125l.116-.006a1.125 1.125 0 0 0 0-2.238L17 17.875H7a1.125 1.125 0 0 0 0 2.25z"
      />
      <path
        fill={color}
        d="M5.875 19a.876.876 0 1 0-1.75 0 .876.876 0 0 0 1.75 0m14 0a.876.876 0 1 0-1.752 0 .876.876 0 0 0 1.752 0m-14-14a.876.876 0 1 0-1.751.002A.876.876 0 0 0 5.875 5m14 0a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0M8.125 19a3.126 3.126 0 1 1-6.251-.002A3.126 3.126 0 0 1 8.125 19m14 0a3.125 3.125 0 1 1-6.25 0 3.125 3.125 0 0 1 6.25 0m-14-14a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0m14 0a3.126 3.126 0 1 1-6.252 0 3.126 3.126 0 0 1 6.252 0"
      />
    </svg>
  );
}
