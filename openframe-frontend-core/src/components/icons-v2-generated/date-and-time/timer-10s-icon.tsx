import type { SVGProps } from "react";
export interface Timer10sIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Timer10sIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Timer10sIconProps) {
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
        d="M10.876 5V2l.005-.116a1.125 1.125 0 0 1 1.12-1.009c6.143 0 11.124 4.981 11.124 11.126 0 6.143-4.98 11.123-11.124 11.124C5.856 23.125.875 18.145.875 12c0-3.032 1.214-5.784 3.18-7.79a1.125 1.125 0 0 1 1.607 1.577 8.875 8.875 0 1 0 7.463-2.59V5a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M7.875 15v-3.444a1.12 1.12 0 0 1-1.17-1.851l1.5-1.5a1.126 1.126 0 0 1 1.92.795v6a1.125 1.125 0 0 1-2.25 0m5.75-1.125h1v-3.75h-1zm3.25.124a2.126 2.126 0 0 1-2.126 2.126H13.5a2.126 2.126 0 0 1-2.126-2.126v-3.998c0-1.174.952-2.126 2.126-2.126h1.25c1.173 0 2.125.952 2.125 2.126z"
      />
    </svg>
  );
}
