import type { SVGProps } from "react";
export interface UserBannedIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function UserBannedIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: UserBannedIconProps) {
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
        d="M20.875 18a2.875 2.875 0 0 0-3.95-2.665l3.74 3.74c.134-.333.21-.695.21-1.075m-5.75 0a2.875 2.875 0 0 0 3.95 2.665l-3.74-3.74c-.135.332-.21.695-.21 1.075m8 0a5.124 5.124 0 1 1-10.249 0 5.124 5.124 0 0 1 10.249 0m-12.526-4.125.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H7.143a4.014 4.014 0 0 0-4.005 3.75h7.46l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H2.857a1.98 1.98 0 0 1-1.982-1.982 6.27 6.27 0 0 1 6.268-6.268zm2.527-6.625a3.126 3.126 0 1 0-6.252.002 3.126 3.126 0 0 0 6.252-.002m2.25 0a5.376 5.376 0 1 1-10.75 0 5.376 5.376 0 0 1 10.75 0"
      />
    </svg>
  );
}
