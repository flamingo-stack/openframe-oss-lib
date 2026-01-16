import type { SVGProps } from "react";
export interface CodingPullRequestClosedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodingPullRequestClosedIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CodingPullRequestClosedIconProps) {
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
        d="M4.375 16V8a1.125 1.125 0 0 1 2.25 0v8a1.125 1.125 0 0 1-2.25 0m13 0v-5a1.125 1.125 0 0 1 2.25 0v5a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M6.875 18.5a1.374 1.374 0 1 0-2.749 0 1.374 1.374 0 0 0 2.749 0m13 0a1.375 1.375 0 1 0-2.75.002 1.375 1.375 0 0 0 2.75-.002m-13-13a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m13.33-3.295a1.125 1.125 0 1 1 1.59 1.59L20.09 5.5l1.705 1.705.078.087a1.125 1.125 0 0 1-1.583 1.582l-.085-.078L18.5 7.09l-1.704 1.705a1.125 1.125 0 1 1-1.59-1.59l1.703-1.706-1.704-1.704-.078-.085a1.125 1.125 0 0 1 1.582-1.583l.087.078L18.5 3.908zM9.125 18.5a3.625 3.625 0 1 1-7.25 0 3.625 3.625 0 0 1 7.25 0m13 0a3.626 3.626 0 0 1-7.25 0 3.624 3.624 0 0 1 7.25 0m-13-13a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0"
      />
    </svg>
  );
}
