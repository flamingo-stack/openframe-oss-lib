import type { SVGProps } from "react";
export interface RouteLocationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RouteLocationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RouteLocationIconProps) {
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
        d="M18.875 16.25a2.125 2.125 0 0 0-2.125-2.124H7.5a4.626 4.626 0 0 1 0-9.251h3.82l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H7.5a2.375 2.375 0 0 0 0 4.75h9.25a4.375 4.375 0 1 1 0 8.75H8a1.125 1.125 0 0 1 0-2.25h8.75a2.126 2.126 0 0 0 2.125-2.125"
      />
      <path
        fill={color}
        d="M6.875 19.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0M19.87 4.85c0-.887-.793-1.725-1.75-1.725-.956 0-1.75.837-1.75 1.726V5l.012.2c.056.473.306.977.701 1.483.33.421.716.782 1.036 1.05.32-.268.707-.628 1.037-1.05.453-.578.714-1.154.714-1.683zm-1.74-.975.114.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-.01a1.125 1.125 0 0 1 0-2.25zM9.124 19.5a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0M22.12 5c0 1.246-.595 2.306-1.193 3.07a9.8 9.8 0 0 1-1.743 1.695c-.63.48-1.499.48-2.128 0a9.8 9.8 0 0 1-1.743-1.695c-.561-.716-1.12-1.693-1.187-2.839L14.121 5v-.15c0-2.111 1.782-3.975 4-3.975s4 1.864 4 3.976V5Z"
      />
    </svg>
  );
}
