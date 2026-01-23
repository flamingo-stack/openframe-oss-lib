import type { SVGProps } from "react";
export interface Refresh01RightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Refresh01RightIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Refresh01RightIconProps) {
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
        d="M1.875 12C1.875 6.408 6.408 1.875 12 1.875c4.451 0 6.842 2.692 8.92 4.915l.875.915.078.085a1.126 1.126 0 0 1-1.583 1.582l-.085-.076-.964-.995C17.08 6.026 15.424 4.125 12 4.125a7.875 7.875 0 1 0 7.427 10.5 1.125 1.125 0 0 1 2.12.75c-1.389 3.93-5.137 6.75-9.547 6.75-5.592 0-10.125-4.533-10.125-10.125"
      />
      <path
        fill={color}
        d="M19.875 3.5a1.125 1.125 0 0 1 2.25 0v5a1.124 1.124 0 0 1-1.127 1.126L16 9.624l-.116-.005A1.125 1.125 0 0 1 16 7.374h3.875z"
      />
    </svg>
  );
}
