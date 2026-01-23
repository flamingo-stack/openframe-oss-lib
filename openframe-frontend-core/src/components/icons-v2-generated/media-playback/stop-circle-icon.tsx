import type { SVGProps } from "react";
export interface StopCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StopCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: StopCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M10.125 13.875h3.75v-3.75h-3.75zm6 .124a2.126 2.126 0 0 1-2.126 2.126h-3.998a2.126 2.126 0 0 1-2.126-2.126v-3.998c0-1.174.952-2.126 2.126-2.126h3.998c1.174 0 2.126.952 2.126 2.126z"
      />
    </svg>
  );
}
