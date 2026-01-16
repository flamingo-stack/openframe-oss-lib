import type { SVGProps } from "react";
export interface StockingsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StockingsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: StockingsIconProps) {
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
        d="M16.873 12.354A2.88 2.88 0 0 0 15.125 15c0 .64.213 1.232.568 1.71a4.88 4.88 0 0 0 1.18-3.178zM6.434 15.527a3.78 3.78 0 0 0 .8 4.169l.07.072.287.259a3.79 3.79 0 0 0 3.878.54zm12.689-1.995a7.13 7.13 0 0 1-2.09 5.045l-2.784 2.781a6.04 6.04 0 0 1-8.31.214l-.226-.214-.07-.07a6.03 6.03 0 0 1-.27-8.243l.024-.029a6 6 0 0 1 .246-.26l.365-.364.195-.215c.369-.447.6-.986.657-1.543l.015-.28V5.5a1.125 1.125 0 0 1 2.25 0v4.854l-.007.258a5.15 5.15 0 0 1-1.292 3.125l5.427 5.434.848-.848A5.1 5.1 0 0 1 12.875 15a5.126 5.126 0 0 1 3.998-5V5.5a1.125 1.125 0 0 1 2.25 0v5.442l.002.059-.002.045z"
      />
      <path
        fill={color}
        d="M8.125 4.375h9.75v-1.25h-9.75zm12 .125A2.125 2.125 0 0 1 18 6.625H8A2.125 2.125 0 0 1 5.876 4.5V3c0-1.173.952-2.125 2.126-2.125H18c1.173 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
