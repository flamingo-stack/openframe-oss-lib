import type { SVGProps } from "react";
export interface RouteArrowIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RouteArrowIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: RouteArrowIconProps) {
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
        d="M18.875 15.875a2.5 2.5 0 0 0-2.5-2.5h-8.75a4.75 4.75 0 1 1 0-9.5H21l.115.006a1.125 1.125 0 0 1 0 2.238L21 6.125H7.625a2.5 2.5 0 0 0 0 5h8.75a4.75 4.75 0 0 1 0 9.5H8a1.125 1.125 0 0 1 0-2.25h8.375a2.5 2.5 0 0 0 2.5-2.5"
      />
      <path
        fill={color}
        d="M6.875 19.5a1.376 1.376 0 1 0-2.751.001 1.376 1.376 0 0 0 2.751 0Zm10.33-18.295a1.125 1.125 0 0 1 1.505-.078l.085.078 3 3a1.124 1.124 0 0 1 0 1.59l-3 3a1.125 1.125 0 1 1-1.59-1.59L19.409 5l-2.204-2.205-.078-.085a1.125 1.125 0 0 1 .078-1.505M9.125 19.5a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0"
      />
    </svg>
  );
}
