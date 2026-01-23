import type { SVGProps } from "react";
export interface StairsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StairsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StairsIconProps) {
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
        d="M18.125 8.5a2.125 2.125 0 0 1-2.126 2.124h-2.873V13.5A2.126 2.126 0 0 1 11 15.626H8.125V18.5A2.125 2.125 0 0 1 6 20.625H2a1.125 1.125 0 0 1 0-2.25h3.875v-2.876c0-1.173.952-2.123 2.125-2.123h2.876V10.5c0-1.173.95-2.125 2.123-2.125h2.876V5.5c0-1.173.952-2.125 2.125-2.125h4l.115.006a1.125 1.125 0 0 1 0 2.238L22 5.625h-3.875z"
      />
    </svg>
  );
}
