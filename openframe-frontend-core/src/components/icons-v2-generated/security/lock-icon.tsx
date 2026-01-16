import type { SVGProps } from "react";
export interface LockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LockIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LockIconProps) {
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
        d="M14.874 10V6a2.875 2.875 0 1 0-5.749 0v4a1.125 1.125 0 0 1-2.25 0V6a5.126 5.126 0 0 1 10.25 0v4a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M18.875 13c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 6A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19v-6A4.125 4.125 0 0 1 7 8.875h10A4.125 4.125 0 0 1 21.125 13z"
      />
    </svg>
  );
}
