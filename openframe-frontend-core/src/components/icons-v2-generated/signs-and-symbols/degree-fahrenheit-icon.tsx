import type { SVGProps } from "react";
export interface DegreeFahrenheitIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DegreeFahrenheitIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DegreeFahrenheitIconProps) {
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
        d="M6.875 7.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0m1.75 12.5V4.5c0-.898.727-1.625 1.624-1.625H21a1.125 1.125 0 0 1 0 2.25h-7.875v5.25H20l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-6.875V20a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
