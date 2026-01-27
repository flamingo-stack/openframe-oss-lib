import type { SVGProps } from "react";
export interface LockSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LockSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LockSquareIconProps) {
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
        d="M9.125 15.876h5.75v-2.752h-5.75zm4.25-6.376a1.375 1.375 0 1 0-2.75 0v1.374h2.75zm2.25 1.468a2.125 2.125 0 0 1 1.5 2.032v3a2.125 2.125 0 0 1-2.124 2.125H9A2.126 2.126 0 0 1 6.874 16v-3c0-.956.631-1.765 1.5-2.032V9.5a3.626 3.626 0 0 1 7.25 0v1.468Z"
      />
    </svg>
  );
}
