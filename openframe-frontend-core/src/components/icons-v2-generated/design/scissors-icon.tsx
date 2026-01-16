import type { SVGProps } from "react";
export interface ScissorsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ScissorsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ScissorsIconProps) {
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
        d="M6.875 11a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0c0 .225-.024.444-.059.66l12.59-4.051a1.125 1.125 0 0 1 .69 2.141L6.344 14.9q-.026.007-.052.013A4.1 4.1 0 0 1 5 15.125 4.125 4.125 0 1 1 9.125 11"
      />
      <path
        fill={color}
        d="M14.875 19a1.875 1.875 0 1 1-3.75 0 1.875 1.875 0 0 1 3.75 0m2.25 0A4.125 4.125 0 0 0 13 14.875a4 4 0 0 0-.66.059l4.054-12.592.03-.112a1.126 1.126 0 0 0-2.13-.685l-.042.107L9.1 17.655q-.006.026-.012.051A4.1 4.1 0 0 0 8.875 19a4.125 4.125 0 0 0 8.25 0"
      />
    </svg>
  );
}
