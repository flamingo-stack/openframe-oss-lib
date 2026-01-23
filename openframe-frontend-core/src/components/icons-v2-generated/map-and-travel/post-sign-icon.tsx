import type { SVGProps } from "react";
export interface PostSignIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PostSignIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PostSignIconProps) {
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
        d="M10.874 12a1.125 1.125 0 0 1 2.25 0v8.875h.877l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H10a1.125 1.125 0 0 1 0-2.25h.874zm0-7V2a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.153 3.875c.846 0 1.655.343 2.244.95l2.127 2.196.14.16c.612.77.611 1.866 0 2.637l-.14.161-2.127 2.196a3.13 3.13 0 0 1-2.244.95H6A3.126 3.126 0 0 1 2.875 10V7A3.125 3.125 0 0 1 6 3.875zM5.125 10c0 .483.391.875.875.876h11.153a.88.88 0 0 0 .628-.267l2.042-2.11-2.042-2.107a.88.88 0 0 0-.628-.267H6A.875.875 0 0 0 5.125 7z"
      />
    </svg>
  );
}
