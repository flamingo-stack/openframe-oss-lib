import type { SVGProps } from "react";
export interface ChartPieIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartPieIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChartPieIconProps) {
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
        d="M10.875 2a1.125 1.125 0 0 1 2.25 0v8.131l6.848-3.625.106-.048a1.124 1.124 0 0 1 .947 2.036l-7.155 3.786 5.925 5.924.076.087a1.124 1.124 0 0 1-1.582 1.582l-.085-.078-7-7a1.12 1.12 0 0 1-.33-.794z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.855.875 12 .875s11.125 4.981 11.125 11.126Z"
      />
    </svg>
  );
}
