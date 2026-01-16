import type { SVGProps } from "react";
export interface CodingPullRequestIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodingPullRequestIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CodingPullRequestIconProps) {
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
        d="M4.375 16V8a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0m13 0V8.5c0-1.035-.84-1.875-1.874-1.875h-3.502a1.125 1.125 0 0 1 0-2.25h3.502A4.125 4.125 0 0 1 19.625 8.5V16a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M6.875 18.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m13 0a1.375 1.375 0 1 0-2.75.002 1.375 1.375 0 0 0 2.75-.002m-13-13a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m6.83-3.295a1.125 1.125 0 0 1 1.59 1.59L13.592 5.5l1.705 1.705.076.087a1.124 1.124 0 0 1-1.582 1.582l-.085-.078-2.5-2.5a1.125 1.125 0 0 1 0-1.59l2.5-2.5ZM9.125 18.5a3.625 3.625 0 1 1-7.25 0 3.625 3.625 0 0 1 7.25 0m13 0a3.626 3.626 0 0 1-7.25 0 3.624 3.624 0 0 1 7.25 0m-13-13a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0"
      />
    </svg>
  );
}
