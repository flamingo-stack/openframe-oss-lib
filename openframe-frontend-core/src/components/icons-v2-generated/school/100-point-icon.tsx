import type { SVGProps } from "react";
export interface 100PointIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function 100PointIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: 100PointIconProps) {
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
        d="M3.875 14V7.714l-.08.08a1.125 1.125 0 0 1-1.59-1.59l2-2A1.125 1.125 0 0 1 6.124 5v9a1.125 1.125 0 0 1-2.25 0Zm8-7.5a1.375 1.375 0 0 0-2.75 0v4a1.376 1.376 0 0 0 2.75 0zm8-1a1.376 1.376 0 0 0-2.75 0v4a1.375 1.375 0 1 0 2.75 0zm-5.75 5a3.626 3.626 0 0 1-7.25 0v-4a3.625 3.625 0 0 1 7.25 0zm8-1a3.626 3.626 0 0 1-7.25 0v-4a3.625 3.625 0 1 1 7.25 0zm-2.31 8.557a1.125 1.125 0 0 1 .37 2.22l-11 1.833a1.126 1.126 0 0 1-.37-2.22zm1-4.167a1.126 1.126 0 0 1 .37 2.22l-18 3a1.126 1.126 0 0 1-.37-2.22z"
      />
    </svg>
  );
}
