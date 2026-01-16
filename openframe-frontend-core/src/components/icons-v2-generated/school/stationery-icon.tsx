import type { SVGProps } from "react";
export interface StationeryIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StationeryIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: StationeryIconProps) {
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
        d="M19.875 4A.875.875 0 0 0 19 3.125h-2a.875.875 0 0 0-.875.875v1.875h3.75zm-.939 14.727a5.1 5.1 0 0 1-1.873 0L18 20.29zm-2.811-2.83.28.187.184.113c.938.529 2.1.491 3.006-.113l.28-.187V8.125h-3.75zm.75-2.898v-2.498a1.125 1.125 0 0 1 2.25 0v2.498a1.125 1.125 0 0 1-2.25 0m5.25 3.923c0 .567-.154 1.123-.445 1.609l-2.287 3.81a1.625 1.625 0 0 1-2.786 0l-2.287-3.81a3.13 3.13 0 0 1-.445-1.609V4A3.125 3.125 0 0 1 17 .875h2A3.125 3.125 0 0 1 22.125 4zM9.875 4A.875.875 0 0 0 9 3.125H5A.875.875 0 0 0 4.125 4v1.875H6l.116.005a1.126 1.126 0 0 1 0 2.239L6 8.125H4.125v2.75H6l.116.006a1.125 1.125 0 0 1 0 2.239L6 13.126H4.125v2.749H6l.116.006a1.125 1.125 0 0 1 0 2.238L6 18.125H4.125V20c0 .483.391.874.875.875h4A.874.874 0 0 0 9.875 20zm2.25 16A3.124 3.124 0 0 1 9 23.125H5A3.125 3.125 0 0 1 1.875 20V4A3.125 3.125 0 0 1 5 .875h4A3.125 3.125 0 0 1 12.124 4z"
      />
    </svg>
  );
}
