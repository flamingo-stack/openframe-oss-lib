import type { SVGProps } from "react";
export interface QuoteLeftIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function QuoteLeftIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: QuoteLeftIconProps) {
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
        d="M16.875 9.236c0-1.183.669-2.265 1.727-2.795l.087-.044-.063-.253A3.874 3.874 0 0 0 15.125 10v7c0 .483.392.874.874.875H20a.874.874 0 0 0 .875-.875v-4c0-.423-.3-.776-.7-.857L20 12.125h-2A1.125 1.125 0 0 1 16.875 11zm2.25.639H20a3.125 3.125 0 0 1 3.125 3.124V17A3.124 3.124 0 0 1 20 20.125h-4A3.125 3.125 0 0 1 12.874 17v-7A6.125 6.125 0 0 1 19 3.875h.5l.19.016c.433.074.792.398.902.837l.5 2a1.125 1.125 0 0 1-.59 1.278l-.893.448a.87.87 0 0 0-.484.782zm-14.25-.639c0-1.183.669-2.265 1.728-2.795l.086-.044-.063-.253A3.874 3.874 0 0 0 3.125 10v7c0 .483.391.874.875.875h4A.874.874 0 0 0 8.875 17v-4c0-.423-.3-.776-.7-.857L8 12.125H6A1.125 1.125 0 0 1 4.875 11zm2.25.639H8a3.125 3.125 0 0 1 3.124 3.124V17A3.124 3.124 0 0 1 8 20.125H4A3.125 3.125 0 0 1 .875 17v-7A6.125 6.125 0 0 1 7 3.875h.5l.19.016c.433.074.792.398.902.837l.5 2a1.125 1.125 0 0 1-.59 1.278l-.893.448a.87.87 0 0 0-.484.782z"
      />
    </svg>
  );
}
