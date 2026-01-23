import type { SVGProps } from "react";
export interface SidebarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SidebarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SidebarIconProps) {
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
        d="M8.375 20V4a1.125 1.125 0 0 1 2.25 0v16a1.125 1.125 0 0 1-2.25 0M6.5 11.875a1.125 1.125 0 0 1 0 2.25H5a1.125 1.125 0 0 1 0-2.25zm0-3a1.125 1.125 0 0 1 0 2.25H5a1.125 1.125 0 0 1 0-2.25zm0-3a1.125 1.125 0 0 1 0 2.25H5a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
    </svg>
  );
}
