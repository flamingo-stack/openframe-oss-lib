import type { SVGProps } from "react";
export interface ForkPlateIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ForkPlateIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ForkPlateIconProps) {
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
        d="M11.875 12c0-5.592 4.533-10.125 10.125-10.125a1.125 1.125 0 0 1 0 2.25 7.875 7.875 0 1 0 0 15.75 1.125 1.125 0 0 1 0 2.25c-5.592 0-10.125-4.533-10.125-10.125m4 0A6.124 6.124 0 0 1 22 5.875a1.125 1.125 0 0 1 0 2.25 3.874 3.874 0 0 0-.395 7.73l.395.02.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006-.315-.008A6.125 6.125 0 0 1 15.875 12M4.184 21v-8.957a4.125 4.125 0 0 1-3.297-4.3l.3-4.813a1.125 1.125 0 1 1 2.246.14l-.3 4.812a1.875 1.875 0 0 0 1.87 1.993h.614a1.875 1.875 0 0 0 1.87-1.993l-.3-4.812-.001-.115a1.126 1.126 0 0 1 2.234-.14l.013.115.3 4.813a4.125 4.125 0 0 1-3.299 4.3V21a1.125 1.125 0 0 1-2.25 0m0-13.5V3a1.126 1.126 0 0 1 2.25 0v4.5a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
