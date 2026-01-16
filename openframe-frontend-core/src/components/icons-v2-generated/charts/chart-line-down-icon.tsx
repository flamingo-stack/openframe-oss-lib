import type { SVGProps } from "react";
export interface ChartLineDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartLineDownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChartLineDownIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M6.705 8.705a1.125 1.125 0 0 1 1.505-.078l.085.078 2.63 2.627L12 10.686l.16-.086a2.13 2.13 0 0 1 2.303.284l.133.122 2.698 2.698.078.086a1.125 1.125 0 0 1-1.584 1.583l-.084-.078-2.631-2.63-1.075.648a2.125 2.125 0 0 1-2.463-.198l-.133-.121-2.698-2.699-.078-.085a1.126 1.126 0 0 1 .078-1.505Z"
      />
    </svg>
  );
}
