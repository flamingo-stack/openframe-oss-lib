import type { SVGProps } from "react";
export interface SlidersIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function SlidersIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: SlidersIconProps) {
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
        d="m6 15.876.116.005a1.125 1.125 0 0 1 0 2.239L6 18.125H3a1.125 1.125 0 0 1 0-2.25zm15 0 .116.005a1.125 1.125 0 0 1 0 2.239l-.116.005H10a1.125 1.125 0 0 1 0-2.25zM14 5.875l.115.006a1.125 1.125 0 0 1 0 2.238L14 8.125H3a1.125 1.125 0 0 1 0-2.25zm7 0a1.125 1.125 0 0 1 0 2.25h-3a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M7.125 18.875h1.75v-3.75h-1.75zm8-10h1.75v-3.75h-1.75zm-4 10.125A2.126 2.126 0 0 1 9 21.125H7A2.126 2.126 0 0 1 4.875 19v-4c0-1.174.952-2.124 2.125-2.124h2c1.173 0 2.125.95 2.126 2.123zm8-10A2.126 2.126 0 0 1 17 11.125h-2A2.126 2.126 0 0 1 12.874 9V5c0-1.173.952-2.125 2.126-2.125h2c1.173 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
