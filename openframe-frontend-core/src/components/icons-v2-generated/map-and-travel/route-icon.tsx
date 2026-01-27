import type { SVGProps } from "react";
export interface RouteIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RouteIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RouteIconProps) {
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
        d="M18.875 15.75a2.625 2.625 0 0 0-2.625-2.625h-8.5a4.875 4.875 0 1 1 0-9.75H16a1.125 1.125 0 0 1 0 2.25H7.75a2.625 2.625 0 0 0 0 5.25h8.5a4.875 4.875 0 0 1 0 9.75H8a1.125 1.125 0 0 1 0-2.25h8.25a2.625 2.625 0 0 0 2.625-2.625"
      />
      <path
        fill={color}
        d="M6.875 19.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m13-15a1.376 1.376 0 1 0-2.752.001 1.376 1.376 0 0 0 2.752 0Zm-10.75 15a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0m13-15a3.625 3.625 0 1 1-7.25-.001 3.625 3.625 0 0 1 7.25.001"
      />
    </svg>
  );
}
