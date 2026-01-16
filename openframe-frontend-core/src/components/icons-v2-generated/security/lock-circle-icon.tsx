import type { SVGProps } from "react";
export interface LockCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LockCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LockCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M9.125 15.876h5.75v-2.752h-5.75zm4.25-6.376a1.375 1.375 0 1 0-2.75 0v1.374h2.75zm2.25 1.468a2.125 2.125 0 0 1 1.5 2.032v3a2.125 2.125 0 0 1-2.124 2.125H9A2.126 2.126 0 0 1 6.874 16v-3c0-.956.631-1.765 1.5-2.032V9.5a3.626 3.626 0 0 1 7.25 0v1.468Z"
      />
    </svg>
  );
}
