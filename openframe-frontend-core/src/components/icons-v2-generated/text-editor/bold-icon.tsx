import type { SVGProps } from "react";
export interface BoldIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BoldIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BoldIconProps) {
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
        d="M16.375 16a2.875 2.875 0 0 0-2.874-2.876H7.625v5.751h5.876A2.875 2.875 0 0 0 16.375 16m-1-8A2.876 2.876 0 0 0 12.5 5.125H7.625v5.75H12.5A2.875 2.875 0 0 0 15.376 8Zm2.25 0c0 1.407-.567 2.68-1.485 3.607a5.125 5.125 0 0 1-2.64 9.519h-7A1.125 1.125 0 0 1 5.375 20V4l.006-.116A1.125 1.125 0 0 1 6.5 2.875h6A5.126 5.126 0 0 1 17.625 8"
      />
    </svg>
  );
}
