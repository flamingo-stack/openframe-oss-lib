import type { SVGProps } from "react";
export interface EmailArrowUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailArrowUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: EmailArrowUpIconProps) {
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
        d="M20.875 12.345V5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h7l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H5a4.125 4.125 0 0 1-4.125-4.124V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5v7.345a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.875 21v-3.284l-1.08 1.08a1.125 1.125 0 0 1-1.59-1.59l3-3 .17-.141a1.124 1.124 0 0 1 1.42.14l3 3 .078.085a1.126 1.126 0 0 1-1.582 1.582l-.087-.076-1.08-1.08V21a1.125 1.125 0 0 1-2.25 0Zm3-16c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v.318c0 .319.174.612.453.766l7.519 4.135c.562.31 1.245.31 1.807 0l7.518-4.135.1-.064a.87.87 0 0 0 .353-.702zm2.25.318a3.13 3.13 0 0 1-1.436 2.63l-.183.108-7.518 4.135a4.13 4.13 0 0 1-3.74.119l-.235-.12-7.52-4.134A3.13 3.13 0 0 1 .876 5.318V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5z"
      />
    </svg>
  );
}
