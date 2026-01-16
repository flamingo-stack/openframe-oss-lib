import type { SVGProps } from "react";
export interface ToggleRightIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ToggleRightIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ToggleRightIconProps) {
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
        d="M.875 12A4.125 4.125 0 0 1 5 7.875h8l.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H5a1.875 1.875 0 0 0 0 3.75h8l.115.006a1.125 1.125 0 0 1 0 2.238l-.116.006H5A4.125 4.125 0 0 1 .875 12"
      />
      <path
        fill={color}
        d="M20.875 12a3.876 3.876 0 1 0-7.751.002A3.876 3.876 0 0 0 20.875 12m2.25 0a6.126 6.126 0 1 1-12.25 0 6.126 6.126 0 0 1 12.25 0"
      />
    </svg>
  );
}
