import type { SVGProps } from "react";
export interface PostSignsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PostSignsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PostSignsIconProps) {
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
        d="M10.874 18a1.125 1.125 0 0 1 2.25 0v2.875h.877l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H10a1.125 1.125 0 0 1 0-2.25h.874zm0-6V9a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0m0-9V2a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M18.875 14a.375.375 0 0 0-.375-.375H5.94l-1.755 1.624 1.757 1.626H18.5a.375.375 0 0 0 .375-.375zm-.766-11.625c.468 0 .921.154 1.29.437l.153.128 1.89 1.75.159.165a2.126 2.126 0 0 1 0 2.79l-.16.165-1.89 1.749a2.13 2.13 0 0 1-1.442.567H5.499A2.626 2.626 0 0 1 2.874 7.5V5A2.625 2.625 0 0 1 5.5 2.375zM21.125 16.5a2.625 2.625 0 0 1-2.625 2.625H5.892a2.12 2.12 0 0 1-1.29-.438l-.154-.128-1.89-1.75a2.125 2.125 0 0 1 0-3.118l1.89-1.75.154-.13a2.13 2.13 0 0 1 1.29-.436H18.5A2.625 2.625 0 0 1 21.125 14zm-16-9c0 .207.168.375.374.375h12.56l1.755-1.625-1.753-1.625H5.499A.375.375 0 0 0 5.124 5v2.5Z"
      />
    </svg>
  );
}
