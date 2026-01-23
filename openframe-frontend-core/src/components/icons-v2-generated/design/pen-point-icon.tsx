import type { SVGProps } from "react";
export interface PenPointIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PenPointIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PenPointIconProps) {
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
        d="M5.705 16.704a1.125 1.125 0 1 1 1.59 1.591l-4.347 4.348a1.125 1.125 0 1 1-1.59-1.59z"
      />
      <path
        fill={color}
        d="M15.286 2.318a4.525 4.525 0 1 1 6.397 6.396l-.187.164-9.57 7.98-1.102 3.607a3.23 3.23 0 0 1-2.612 2.25l-.248.028-5.322.379a1.65 1.65 0 0 1-1.765-1.764l.38-5.323a3.23 3.23 0 0 1 2.279-2.86l3.602-1.1 7.983-9.57zM4.194 15.328a.98.98 0 0 0-.692.868l-.332 4.632 4.635-.33.147-.021a.98.98 0 0 0 .72-.67l1.002-3.278-2.203-2.203zM20.206 3.793a2.275 2.275 0 0 0-3.356.153l-7.54 9.038 1.705 1.705 9.04-7.538a2.276 2.276 0 0 0 .15-3.358Z"
      />
    </svg>
  );
}
