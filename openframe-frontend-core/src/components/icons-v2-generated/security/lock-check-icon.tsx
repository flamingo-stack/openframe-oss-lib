import type { SVGProps } from "react";
export interface LockCheckIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LockCheckIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LockCheckIconProps) {
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
        d="M18.875 13c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm-4.17-.045a1.125 1.125 0 0 1 1.59 1.59l-4.5 4.5c-.438.44-1.15.44-1.59 0l-2-2-.077-.086a1.124 1.124 0 0 1 1.582-1.582l.085.078 1.204 1.204zM21.125 19A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19v-6A4.125 4.125 0 0 1 7 8.875h10A4.125 4.125 0 0 1 21.125 13z"
      />
    </svg>
  );
}
