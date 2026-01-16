import type { SVGProps } from "react";
export interface BedFrontIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BedFrontIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BedFrontIconProps) {
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
        d="M19.875 12.354V6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v6.354a1.125 1.125 0 0 1-2.25 0V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6v6.354a1.125 1.125 0 0 1-2.25 0M11.375 11a1.125 1.125 0 0 1-2.25 0V9.124h-2v1.874a1.125 1.125 0 0 1-2.25 0V9c0-1.174.952-2.125 2.125-2.125h2.25c1.174 0 2.124.952 2.124 2.125zm7.75 0a1.125 1.125 0 0 1-2.25 0V9.124h-2v1.874a1.125 1.125 0 0 1-2.25 0V9c0-1.173.951-2.125 2.124-2.125H17c1.174 0 2.126.951 2.126 2.125v2Z"
      />
      <path
        fill={color}
        d="M20.875 15A2.876 2.876 0 0 0 18 12.125H6a2.876 2.876 0 0 0-2.875 2.877v.874h17.75v-.874Zm2.25 6a1.125 1.125 0 0 1-2.25 0v-1.875H3.125V21a1.125 1.125 0 0 1-2.25 0v-6A5.126 5.126 0 0 1 6 9.876h12a5.125 5.125 0 0 1 5.125 5.126v6Z"
      />
    </svg>
  );
}
