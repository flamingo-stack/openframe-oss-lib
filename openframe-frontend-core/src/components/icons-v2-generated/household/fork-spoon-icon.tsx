import type { SVGProps } from "react";
export interface ForkSpoonIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ForkSpoonIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ForkSpoonIconProps) {
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
        d="M19.876 7c0-1.733-1.201-2.875-2.376-2.875S15.125 5.267 15.125 7s1.2 2.874 2.375 2.875S19.875 8.734 19.876 7m2.25 0c0 2.293-1.413 4.406-3.501 4.974V21a1.125 1.125 0 0 1-2.25 0v-9.026c-2.088-.569-3.5-2.68-3.5-4.974 0-2.684 1.934-5.125 4.625-5.125S22.126 4.315 22.126 7M5.184 21v-8.957a4.125 4.125 0 0 1-3.297-4.3l.3-4.813a1.125 1.125 0 1 1 2.246.14l-.3 4.812a1.875 1.875 0 0 0 1.87 1.993h.614a1.875 1.875 0 0 0 1.87-1.993l-.3-4.812-.001-.115a1.126 1.126 0 0 1 2.234-.14l.013.115.3 4.813a4.125 4.125 0 0 1-3.299 4.3V21a1.125 1.125 0 0 1-2.25 0m0-13.5V3a1.126 1.126 0 0 1 2.25 0v4.5a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
