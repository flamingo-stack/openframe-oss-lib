import type { SVGProps } from "react";
export interface CodeBarIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodeBarIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CodeBarIconProps) {
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
        d="M.875 18V6a1.125 1.125 0 0 1 2.25 0v12a1.125 1.125 0 0 1-2.25 0m10.526 0V6a1.125 1.125 0 1 1 2.25 0v12a1.125 1.125 0 0 1-2.25 0m9.474 0V6a1.125 1.125 0 0 1 2.25 0v12a1.125 1.125 0 0 1-2.25 0M8.315 4.875c.622 0 1.125.504 1.125 1.125v12c0 .621-.503 1.125-1.125 1.125H6.21A1.125 1.125 0 0 1 5.085 18V6l.006-.116a1.125 1.125 0 0 1 1.12-1.009zm9.475 0c.621 0 1.125.504 1.125 1.125v12c0 .621-.504 1.125-1.125 1.125h-1.053A1.125 1.125 0 0 1 15.612 18V6l.006-.116a1.125 1.125 0 0 1 1.119-1.009z"
      />
    </svg>
  );
}
