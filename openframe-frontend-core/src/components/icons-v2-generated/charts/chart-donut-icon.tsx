import type { SVGProps } from "react";
export interface ChartDonutIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartDonutIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartDonutIconProps) {
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
        d="M19.795 18.204a1.125 1.125 0 0 1-1.59 1.592zM14.875 12a2.875 2.875 0 1 0-5.747-.002 2.875 2.875 0 0 0 5.746.002Zm5.099-5.494a1.125 1.125 0 0 1 1.053 1.988zM17.124 12a5.1 5.1 0 0 1-.795 2.74l3.466 3.463-.796.796-.793.796-3.47-3.464A5.125 5.125 0 1 1 10.876 7V2a1.125 1.125 0 0 1 2.25 0v5a5.12 5.12 0 0 1 2.765 1.666l4.084-2.16.526.994.527.994-4.084 2.162c.116.429.181.88.181 1.345Z"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
