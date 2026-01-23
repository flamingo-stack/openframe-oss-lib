import type { SVGProps } from "react";
export interface EmailIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmailIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v.318c0 .319.174.612.453.766l7.519 4.135c.562.31 1.245.31 1.807 0l7.518-4.135.1-.064a.87.87 0 0 0 .353-.702zm2.25.318a3.13 3.13 0 0 1-1.436 2.63l-.183.108-7.518 4.135a4.13 4.13 0 0 1-3.74.119l-.235-.12-7.52-4.134A3.13 3.13 0 0 1 .876 7.318V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
    </svg>
  );
}
