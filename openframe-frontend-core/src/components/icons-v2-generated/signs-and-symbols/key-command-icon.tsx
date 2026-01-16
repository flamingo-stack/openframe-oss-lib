import type { SVGProps } from "react";
export interface KeyCommandIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function KeyCommandIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: KeyCommandIconProps) {
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
        d="M7.875 16.125H6A1.875 1.875 0 1 0 7.875 18zm12 1.875c0-1.035-.84-1.875-1.875-1.875h-1.875V18a1.875 1.875 0 0 0 3.75 0m-9.75-4.125h3.75v-3.75h-3.75zM7.875 6A1.875 1.875 0 1 0 6 7.875h1.875zm12 0a1.875 1.875 0 0 0-3.75 0v1.875H18c1.035 0 1.875-.84 1.875-1.875m2.25 0A4.125 4.125 0 0 1 18 10.125h-1.875v3.75H18A4.125 4.125 0 1 1 13.875 18v-1.875h-3.75V18A4.125 4.125 0 1 1 6 13.875h1.875v-3.75H6A4.125 4.125 0 1 1 10.125 6v1.875h3.75V6a4.125 4.125 0 1 1 8.25 0"
      />
    </svg>
  );
}
