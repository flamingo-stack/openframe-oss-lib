import type { SVGProps } from "react";
export interface DropperIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DropperIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: DropperIconProps) {
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
        d="M10.195 6.847a1.125 1.125 0 0 1 1.59 1.591l-6.713 6.715a2.1 2.1 0 0 0-.6 1.25l-.393 3.517 3.518-.392.176-.026c.406-.08.78-.28 1.074-.574l6.715-6.713a1.125 1.125 0 1 1 1.59 1.59l-6.714 6.714a4.35 4.35 0 0 1-2.228 1.19l-.365.056-3.435.381-1.067.712a1.589 1.589 0 0 1-2.201-2.201l.712-1.068.38-3.434.056-.365a4.35 4.35 0 0 1 1.191-2.228z"
      />
      <path
        fill={color}
        d="M15.058 1.994a4.345 4.345 0 0 1 5.982.154l.813.813.154.161a4.346 4.346 0 0 1 0 5.822l-.154.16-3.905 3.904.278.279.078.086a1.125 1.125 0 0 1-1.584 1.582l-.085-.077-7.513-7.514-.078-.085a1.126 1.126 0 0 1 1.584-1.582l.085.077.278.278 3.904-3.904zm4.391 1.745a2.096 2.096 0 0 0-2.963 0L12.58 7.643l3.776 3.775 3.905-3.904.144-.158a2.1 2.1 0 0 0 0-2.646l-.144-.158z"
      />
    </svg>
  );
}
