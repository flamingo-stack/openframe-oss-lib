import type { SVGProps } from "react";
export interface ExpandArrowHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ExpandArrowHrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ExpandArrowHrIconProps) {
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
        d="m22 10.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M5.205 7.205a1.125 1.125 0 0 1 1.59 1.59L3.592 12l3.205 3.205.076.086a1.124 1.124 0 0 1-1.582 1.582l-.085-.077-4-4a1.125 1.125 0 0 1 0-1.59l4-4Zm12 0a1.125 1.125 0 0 1 1.505-.078l.086.078 3.999 4c.44.44.44 1.152 0 1.59l-4 4a1.125 1.125 0 1 1-1.59-1.59l3.204-3.206-3.204-3.204-.078-.085a1.125 1.125 0 0 1 .078-1.505"
      />
    </svg>
  );
}
