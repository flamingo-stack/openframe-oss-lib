import type { SVGProps } from "react";
export interface FontIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FontIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FontIconProps) {
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
        d="M22 11.875c.621 0 1.125.504 1.125 1.125v6c0 .621-.504 1.125-1.125 1.125a1.12 1.12 0 0 1-.96-.545 4.1 4.1 0 0 1-2.04.545 4.125 4.125 0 1 1 0-8.25 4.1 4.1 0 0 1 2.04.545 1.12 1.12 0 0 1 .96-.545M17.125 16a1.875 1.875 0 1 0 3.75 0 1.875 1.875 0 0 0-3.75 0m-14.07 3.392a1.126 1.126 0 0 1-2.11-.784zm11-.784a1.124 1.124 0 0 1-2.109.784zM7.5 3.875c.573 0 1.082.317 1.356.814l.103.223 5.094 13.696L13 19l-1.054.392-1.215-3.267H4.27l-1.216 3.267L2 19l-1.055-.392L6.04 4.912l.103-.223A1.55 1.55 0 0 1 7.5 3.875m-2.394 10h4.787L7.501 7.44l-2.394 6.436Z"
      />
    </svg>
  );
}
