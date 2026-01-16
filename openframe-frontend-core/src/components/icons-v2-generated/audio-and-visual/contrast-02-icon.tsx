import type { SVGProps } from "react";
export interface Contrast02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Contrast02Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Contrast02IconProps) {
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
        d="M10.875 22V2a1.125 1.125 0 0 1 2.25 0v2.875h6.876l.114.006a1.125 1.125 0 0 1 0 2.239l-.114.005h-6.876v1.75H21.8l.116.005a1.125 1.125 0 0 1 0 2.239l-.116.005h-8.675v1.751H21.8l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-8.675v1.75h6.876l.114.006a1.125 1.125 0 0 1 0 2.239l-.114.005h-6.876V22a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.981 11.124-11.125 11.125S.875 18.145.875 12 5.855.875 12 .875s11.125 4.981 11.125 11.126Z"
      />
    </svg>
  );
}
