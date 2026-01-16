import type { SVGProps } from "react";
export interface MusicNote02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MusicNote02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MusicNote02IconProps) {
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
        d="M19.875 5.001a.876.876 0 0 0-1.02-.864l-7.999 1.335a.875.875 0 0 0-.731.862v1.338l9.75-1.626V5ZM22.125 16a1.125 1.125 0 0 1-2.25 0V8.327l-9.75 1.626V18a1.125 1.125 0 0 1-2.25 0V6.334a3.125 3.125 0 0 1 2.612-3.082l8-1.334A3.126 3.126 0 0 1 22.124 5v11Z"
      />
      <path
        fill={color}
        d="M7.875 18a1.876 1.876 0 0 0-3.75 0 1.875 1.875 0 0 0 3.75 0m12-2a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m-9.75 2a4.124 4.124 0 1 1-8.25 0 4.125 4.125 0 1 1 8.25 0m12-2a4.125 4.125 0 1 1-8.251 0 4.125 4.125 0 0 1 8.251 0"
      />
    </svg>
  );
}
