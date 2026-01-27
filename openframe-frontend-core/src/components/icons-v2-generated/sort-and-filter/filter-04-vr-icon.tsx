import type { SVGProps } from "react";
export interface Filter04VrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Filter04VrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Filter04VrIconProps) {
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
        d="M3.875 20v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m7 0V10a1.125 1.125 0 0 1 2.25 0v10a1.126 1.126 0 0 1-2.25 0m7 0v-2a1.126 1.126 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m0-6V4a1.125 1.125 0 0 1 2.25 0v10a1.125 1.125 0 0 1-2.25 0m-14-2V4a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0m7-6V4a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.875 16a.876.876 0 1 0-1.752 0 .876.876 0 0 0 1.752 0m-14-2a.876.876 0 1 0-1.751 0 .876.876 0 0 0 1.751 0m7-6a.875.875 0 1 0-1.75-.001.875.875 0 0 0 1.75 0Zm9.25 8a3.125 3.125 0 1 1-6.25 0 3.125 3.125 0 0 1 6.25 0m-14-2a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0m7-6a3.125 3.125 0 1 1-6.251 0 3.125 3.125 0 0 1 6.25 0Z"
      />
    </svg>
  );
}
