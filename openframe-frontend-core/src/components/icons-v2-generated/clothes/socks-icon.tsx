import type { SVGProps } from "react";
export interface SocksIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SocksIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SocksIconProps) {
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
        d="M5.915 12.13V3c0-1.173.952-2.125 2.126-2.125h5c.964 0 1.776.641 2.037 1.52l.044.18.017.113a1.125 1.125 0 0 1-2.195.437H8.165v1.75h5.855l.114.006a1.125 1.125 0 0 1 0 2.239l-.114.005H8.165v5.006c0 .725-.252 1.426-.707 1.982l-.208.228-2.414 2.414a2.41 2.41 0 0 0 3.408 3.41l1.18-1.18a1.125 1.125 0 0 1 1.59 1.59l-1.179 1.18a4.66 4.66 0 1 1-6.59-6.59l2.414-2.414.11-.134a.9.9 0 0 0 .146-.486Z"
      />
      <path
        fill={color}
        d="M15.125 4.875h4.75v-1.75h-4.75zm0 7.256c0 .725-.252 1.426-.707 1.982l-.208.228-2.415 2.414a2.41 2.41 0 0 0 3.41 3.41l3.242-3.243a4.88 4.88 0 0 0 1.428-3.448V7.125h-4.75zm7 1.343c0 1.89-.75 3.703-2.087 5.04l-3.243 3.24a4.66 4.66 0 1 1-6.59-6.59l2.414-2.413.11-.134a.9.9 0 0 0 .146-.486V3c0-1.174.952-2.126 2.126-2.126h5c1.173 0 2.124.952 2.124 2.125z"
      />
    </svg>
  );
}
