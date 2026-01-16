import type { SVGProps } from "react";
export interface Logout02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Logout02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Logout02IconProps) {
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
        d="M11.876 7V6c0-1.035-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h4c1.036 0 1.876-.84 1.876-1.875v-1a1.125 1.125 0 0 1 2.25 0v1A4.125 4.125 0 0 1 10 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h4A4.125 4.125 0 0 1 14.127 6v1a1.126 1.126 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M17.205 8.205a1.125 1.125 0 0 1 1.505-.078l.085.078 3 3a1.125 1.125 0 0 1 0 1.59l-3 3a1.125 1.125 0 1 1-1.59-1.59l1.08-1.08H9a1.125 1.125 0 0 1 0-2.25h9.284l-1.08-1.08-.077-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
