import type { SVGProps } from "react";
export interface ForkKnifeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ForkKnifeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ForkKnifeIconProps) {
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
        d="M18.875 21v-4.375H16.5c-1.444 0-2.643-1.178-2.592-2.662.05-1.429.173-3.179.476-5.603.186-1.489.95-2.816 1.883-3.876a10.9 10.9 0 0 1 3.229-2.49A1.127 1.127 0 0 1 21.125 3v18a1.125 1.125 0 0 1-2.25 0m0-15.92a8.4 8.4 0 0 0-.919.89c-.74.842-1.227 1.765-1.34 2.67-.295 2.363-.413 4.044-.46 5.4a.33.33 0 0 0 .344.335h2.375zM6.184 21v-8.957a4.125 4.125 0 0 1-3.297-4.3l.3-4.813a1.125 1.125 0 1 1 2.246.14l-.3 4.812a1.875 1.875 0 0 0 1.87 1.993h.614a1.875 1.875 0 0 0 1.87-1.993l-.3-4.812-.001-.115a1.126 1.126 0 0 1 2.234-.14l.013.115.3 4.813a4.125 4.125 0 0 1-3.299 4.3V21a1.125 1.125 0 0 1-2.25 0m0-13.5V3a1.126 1.126 0 0 1 2.25 0v4.5a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
