import type { SVGProps } from "react";
export interface Number7IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number7Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Number7IconProps) {
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
        d="M9.875 20c0-5.653 2.62-10.605 5.05-14.875H7.5a1.125 1.125 0 0 1 0-2.25H16c1.255 0 2.026 1.355 1.41 2.433-2.612 4.564-5.286 9.315-5.286 14.692a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
