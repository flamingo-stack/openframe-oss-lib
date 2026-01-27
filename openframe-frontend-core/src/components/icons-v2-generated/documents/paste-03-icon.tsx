import type { SVGProps } from "react";
export interface Paste03IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Paste03Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Paste03IconProps) {
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
        d="M20.875 15V6a1.125 1.125 0 0 1 2.25 0v9A8.126 8.126 0 0 1 15 23.125H6a1.125 1.125 0 0 1 0-2.25h9a5.875 5.875 0 0 0 5.867-5.573z"
      />
      <path
        fill={color}
        d="M16.875 5c0-1.035-.84-1.875-1.874-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.874zm2.25 10a4.126 4.126 0 0 1-4.124 4.125H5a4.125 4.125 0 0 1-4.125-4.124V5A4.125 4.125 0 0 1 5 .875h10A4.125 4.125 0 0 1 19.126 5v10Z"
      />
    </svg>
  );
}
