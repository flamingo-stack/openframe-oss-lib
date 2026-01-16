import type { SVGProps } from "react";
export interface SwitchHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SwitchHrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: SwitchHrIconProps) {
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
        d="M7.205 12.205a1.125 1.125 0 0 1 1.59 1.59l-2.08 2.08H20l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H6.715l2.08 2.08.076.086a1.124 1.124 0 0 1-1.582 1.582l-.085-.078-4-4a1.125 1.125 0 0 1 0-1.59zm8-10a1.125 1.125 0 0 1 1.505-.078l.085.078 4 4a1.126 1.126 0 0 1 0 1.59l-4 4a1.125 1.125 0 1 1-1.59-1.59l2.08-2.08H4a1.125 1.125 0 0 1 0-2.25h13.285l-2.08-2.08-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
