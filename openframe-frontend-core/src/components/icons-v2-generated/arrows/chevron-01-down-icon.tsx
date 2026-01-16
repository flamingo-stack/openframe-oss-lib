import type { SVGProps } from "react";
export interface Chevron01DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Chevron01DownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Chevron01DownIconProps) {
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
        d="M19.205 7.205a1.125 1.125 0 0 1 1.59 1.59l-8 8c-.44.44-1.152.44-1.591 0l-8-8-.077-.085A1.125 1.125 0 0 1 4.71 7.127l.085.078L12 14.409l7.206-7.204Z"
      />
    </svg>
  );
}
