import type { SVGProps } from "react";
export interface HotelAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HotelAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HotelAltIconProps) {
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
        d="M19.875 21V8.125h-4.75V21a1.125 1.125 0 0 1-2.25 0V4.125h-8.75V21a1.125 1.125 0 0 1-2.25 0V4.118A1.125 1.125 0 0 1 2 1.875h13l.115.006a1.124 1.124 0 0 1 .01 2.235v1.76H22l.115.005a1.125 1.125 0 0 1 .01 2.236V21a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M9.375 17a.876.876 0 1 0-1.75 0v2.875h1.75zM18 13.874l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.006H17a1.125 1.125 0 0 1 0-2.25zM7 9.875l.115.006a1.125 1.125 0 0 1 0 2.239L7 12.126H6a1.125 1.125 0 0 1 0-2.25zm4 0 .116.006a1.125 1.125 0 0 1 0 2.239l-.116.006h-1a1.126 1.126 0 0 1 0-2.25h1Zm7 0a1.125 1.125 0 0 1 0 2.25h-1a1.125 1.125 0 0 1 0-2.25zm-11-4a1.125 1.125 0 0 1 0 2.25H6a1.125 1.125 0 0 1 0-2.25zm4 0 .116.006a1.125 1.125 0 0 1 0 2.238L11 8.125h-1a1.125 1.125 0 0 1 0-2.25zm.626 14H22l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H2a1.125 1.125 0 0 1 0-2.25h3.375V17a3.126 3.126 0 1 1 6.25 0z"
      />
    </svg>
  );
}
