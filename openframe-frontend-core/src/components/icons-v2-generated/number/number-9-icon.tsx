import type { SVGProps } from "react";
export interface Number9IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Number9Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Number9IconProps) {
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
        d="M15.375 8.5a3.375 3.375 0 1 0-6.75 0V9a3.375 3.375 0 1 0 6.75 0zm2.25 7c0 3.057-2.495 5.625-5.625 5.625-1.85 0-3.63-.898-4.723-2.304l-.208-.287-.06-.098a1.126 1.126 0 0 1 1.853-1.257l.07.093.127.174A3.82 3.82 0 0 0 12 18.876c1.87 0 3.375-1.544 3.375-3.376v-2a5.625 5.625 0 0 1-9-4.5v-.5a5.625 5.625 0 0 1 11.25 0z"
      />
    </svg>
  );
}
