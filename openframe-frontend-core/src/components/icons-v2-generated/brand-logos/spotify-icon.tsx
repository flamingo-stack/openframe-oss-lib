import type { SVGProps } from "react";
export interface SpotifyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SpotifyIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SpotifyIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M15.646 15a1.126 1.126 0 0 1-1.033 2zm-4.644-1.124c1.671 0 3.251.405 4.643 1.125l-.517.998L14.613 17a7.84 7.84 0 0 0-3.611-.875c-.72 0-1.415.096-2.074.276l-.295-1.086-.296-1.085c.85-.231 1.744-.354 2.665-.354M8.928 16.4a1.125 1.125 0 0 1-.59-2.171zM11 10.374c2.23 0 4.321.604 6.118 1.656a1.124 1.124 0 0 1-1.137 1.94 9.8 9.8 0 0 0-4.98-1.346 9.9 9.9 0 0 0-3.143.512l-.11.03a1.126 1.126 0 0 1-.606-2.165l.459-.143a12.1 12.1 0 0 1 3.4-.484Zm.5-3.499c2.645 0 5.103.81 7.134 2.196a1.125 1.125 0 1 1-1.269 1.859A10.37 10.37 0 0 0 11.5 9.125c-1.456 0-2.848.273-4.118.732a1.124 1.124 0 1 1-.764-2.115 14.4 14.4 0 0 1 4.882-.867"
      />
    </svg>
  );
}
