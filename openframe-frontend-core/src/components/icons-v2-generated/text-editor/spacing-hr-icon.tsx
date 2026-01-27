import type { SVGProps } from "react";
export interface SpacingHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SpacingHrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SpacingHrIconProps) {
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
        d="M1.875 21V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0m18 0V3a1.125 1.125 0 0 1 2.25 0v18a1.125 1.125 0 0 1-2.25 0M14.28 8.136a1.124 1.124 0 0 1 1.506.06l.079.083 2.499 3a1.13 1.13 0 0 1 0 1.442l-2.5 3a1.126 1.126 0 0 1-1.728-1.442l.961-1.154H8.902l.963 1.154.069.093a1.126 1.126 0 0 1-1.72 1.432l-.078-.083-2.5-3a1.126 1.126 0 0 1 0-1.442l2.5-3a1.125 1.125 0 0 1 1.729 1.442l-.963 1.154h6.195l-.96-1.154-.071-.093a1.126 1.126 0 0 1 .214-1.492"
      />
    </svg>
  );
}
