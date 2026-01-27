import type { SVGProps } from "react";
export interface HouseDoorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HouseDoorIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HouseDoorIconProps) {
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
        d="M13.875 16a1.875 1.875 0 0 0-3.75 0v3.875h3.75zm2.25 3.875H17c1.035 0 1.875-.84 1.875-1.875V8.44a1.125 1.125 0 1 1 2.25 0V18A4.125 4.125 0 0 1 17 22.125H7A4.125 4.125 0 0 1 2.874 18V8.44a1.125 1.125 0 0 1 2.25 0V18c0 1.035.84 1.875 1.875 1.875h.875V16a4.125 4.125 0 0 1 8.25 0z"
      />
      <path
        fill={color}
        d="M9.75 2.548a4.13 4.13 0 0 1 4.788.205l8.155 6.36a1.126 1.126 0 0 1-1.385 1.774l-8.155-6.36a1.88 1.88 0 0 0-2.176-.094l-.13.094-8.155 6.36-.094.066a1.126 1.126 0 0 1-1.29-1.84l8.156-6.36.285-.205Z"
      />
    </svg>
  );
}
