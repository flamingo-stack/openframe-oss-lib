import type { SVGProps } from "react";
export interface EmailSearchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function EmailSearchIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: EmailSearchIconProps) {
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
        d="M20.875 12.257V5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h6l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H5a4.125 4.125 0 0 1-4.125-4.124V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5v7.257a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.875 18a1.875 1.875 0 1 0-3.75.001 1.875 1.875 0 0 0 3.75 0Zm1-13c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v.318c0 .319.174.612.453.766l7.519 4.135.215.101c.515.204 1.1.17 1.592-.1l7.518-4.136.1-.064a.87.87 0 0 0 .353-.702zm1.25 13a4.1 4.1 0 0 1-.525 2.009l1.195 1.195.078.087a1.124 1.124 0 0 1-1.582 1.582l-.087-.078L20.01 21.6a4.1 4.1 0 0 1-2.009.525A4.125 4.125 0 1 1 22.125 18m1-12.682c0 1.14-.62 2.189-1.62 2.738l-7.517 4.135a4.13 4.13 0 0 1-3.975 0l-7.52-4.135A3.13 3.13 0 0 1 .876 5.318V5A4.125 4.125 0 0 1 5 .875h14A4.125 4.125 0 0 1 23.125 5z"
      />
    </svg>
  );
}
