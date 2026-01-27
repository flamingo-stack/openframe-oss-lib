import type { SVGProps } from "react";
export interface StopwatchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StopwatchIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StopwatchIconProps) {
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
        d="M19.705 5.705a1.125 1.125 0 0 1 1.59 1.59l-1.5 1.5a1.125 1.125 0 0 1-1.59-1.59zM10.875 5V3.125H9a1.125 1.125 0 0 1 0-2.25h6l.116.006a1.125 1.125 0 0 1 0 2.238L15 3.125h-1.875V5a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.375 13.5a7.375 7.375 0 1 0-14.751 0 7.375 7.375 0 0 0 14.75 0Zm-8.5 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0m10.75 0A9.624 9.624 0 0 1 12 23.126c-5.316 0-9.626-4.309-9.626-9.624S6.684 3.876 12 3.876s9.624 4.31 9.624 9.626Z"
      />
    </svg>
  );
}
