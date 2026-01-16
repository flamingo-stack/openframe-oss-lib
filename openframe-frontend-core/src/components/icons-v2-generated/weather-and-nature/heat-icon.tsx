import type { SVGProps } from "react";
export interface HeatIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HeatIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HeatIconProps) {
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
        d="M18.325 3.1a1.125 1.125 0 0 1 1.35 1.8l-.121.09a3.575 3.575 0 0 0-.646 5.094l1.94 2.427a5.825 5.825 0 0 1-.812 8.11l-.24.188-.12.091-.096.064a1.125 1.125 0 0 1-1.255-1.864l.121-.091.287-.239a3.58 3.58 0 0 0 .578-4.55l-.219-.304-1.94-2.426a5.826 5.826 0 0 1 1.053-8.3zm-14 0a1.125 1.125 0 0 1 1.35 1.8l-.121.09a3.575 3.575 0 0 0-.646 5.094l1.94 2.427a5.825 5.825 0 0 1-.812 8.11l-.24.188-.12.091-.096.064A1.125 1.125 0 0 1 4.325 19.1l.121-.091.287-.239a3.58 3.58 0 0 0 .578-4.55l-.219-.304-1.94-2.426a5.826 5.826 0 0 1 1.053-8.3zm7.096-.064A1.125 1.125 0 0 1 12.674 4.9l-.12.09a3.575 3.575 0 0 0-.646 5.094l1.941 2.427a5.826 5.826 0 0 1-.813 8.11l-.24.188-.122.091a1.125 1.125 0 0 1-1.349-1.8l.12-.091.287-.239a3.576 3.576 0 0 0 .36-4.854L10.15 11.49a5.826 5.826 0 0 1 1.054-8.3l.121-.09z"
      />
    </svg>
  );
}
