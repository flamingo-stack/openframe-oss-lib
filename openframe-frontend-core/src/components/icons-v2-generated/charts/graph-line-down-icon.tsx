import type { SVGProps } from "react";
export interface GraphLineDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GraphLineDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GraphLineDownIconProps) {
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
        d="M1.875 18V3a1.125 1.125 0 0 1 2.25 0v15c0 1.035.84 1.875 1.875 1.875h15a1.125 1.125 0 0 1 0 2.25H6A4.125 4.125 0 0 1 1.875 18"
      />
      <path
        fill={color}
        d="M6.644 3.932a1.126 1.126 0 0 1 1.381.605l.043.107 2.06 6.188a.875.875 0 0 0 1.596.147l.585-1.051.13-.216c1.408-2.138 4.733-1.753 5.566.746l2.063 6.186.03.111a1.126 1.126 0 0 1-2.123.708l-.043-.107-2.06-6.188a.877.877 0 0 0-1.52-.263l-.076.116-.585 1.051c-1.32 2.377-4.837 2.05-5.696-.53L5.932 5.356l-.03-.111a1.126 1.126 0 0 1 .742-1.313"
      />
    </svg>
  );
}
