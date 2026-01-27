import type { SVGProps } from "react";
export interface BatteryMediumIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BatteryMediumIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BatteryMediumIconProps) {
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
        d="M17.875 9c0-1.036-.84-1.875-1.876-1.875H5c-1.036 0-1.875.84-1.875 1.875v6c0 1.035.84 1.875 1.875 1.875h11c1.035 0 1.875-.84 1.875-1.875zm2.25 6a4.125 4.125 0 0 1-4.126 4.125H5A4.125 4.125 0 0 1 .875 15V9A4.125 4.125 0 0 1 5 4.875h11A4.125 4.125 0 0 1 20.124 9v6Z"
      />
      <path
        fill={color}
        d="M4.875 14v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m4.5 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0m11.5 0v-4a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0"
      />
    </svg>
  );
}
