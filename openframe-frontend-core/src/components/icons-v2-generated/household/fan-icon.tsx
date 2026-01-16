import type { SVGProps } from "react";
export interface FanIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FanIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FanIconProps) {
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
        d="M17.375 7A3.876 3.876 0 0 0 13.5 3.125h-.375V9a1.125 1.125 0 0 1-2.25 0V2.5c0-.898.73-1.625 1.627-1.625h.998a6.126 6.126 0 0 1 1.827 11.972 1.125 1.125 0 1 1-.67-2.147 3.88 3.88 0 0 0 2.72-3.7Zm-4.25 14.5c0 .898-.727 1.625-1.625 1.625h-1a6.125 6.125 0 0 1-1.827-11.973 1.125 1.125 0 0 1 .67 2.148 3.875 3.875 0 0 0 1.156 7.575h.376V15a1.125 1.125 0 0 1 2.25 0z"
      />
      <path
        fill={color}
        d="M20.875 13.124h-4.91a4.13 4.13 0 0 1-2.154 2.576 3.875 3.875 0 0 0 7.064-2.2zm-8.874-3a1.875 1.875 0 1 0 0 3.751 1.875 1.875 0 0 0 0-3.75ZM23.125 13.5a6.122 6.122 0 0 1-11.675 2.584 4.12 4.12 0 0 1-3.416-2.958H2.5A1.625 1.625 0 0 1 .875 11.5v-1A6.122 6.122 0 0 1 12.55 7.915a4.12 4.12 0 0 1 3.416 2.958H21.5c.898 0 1.625.729 1.625 1.627v.998Zm-20-2.625h4.909a4.13 4.13 0 0 1 2.153-2.576A3.875 3.875 0 0 0 3.125 10.5z"
      />
    </svg>
  );
}
