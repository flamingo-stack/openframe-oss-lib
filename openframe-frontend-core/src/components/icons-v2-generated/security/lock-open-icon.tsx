import type { SVGProps } from "react";
export interface LockOpenIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LockOpenIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LockOpenIconProps) {
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
        d="M20.875 9V6a2.875 2.875 0 1 0-5.75 0v4a1.125 1.125 0 0 1-2.25 0V6a5.126 5.126 0 0 1 10.25 0v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M16.875 13c0-1.035-.84-1.875-1.874-1.875H5c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 6a4.125 4.125 0 0 1-4.124 4.125H5A4.125 4.125 0 0 1 .875 19v-6A4.125 4.125 0 0 1 5 8.875h10A4.125 4.125 0 0 1 19.126 13v6Z"
      />
    </svg>
  );
}
