import type { SVGProps } from "react";
export interface CompassIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CompassIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CompassIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M15.535 6.976a1.124 1.124 0 0 1 1.488 1.49l-2.343 5.158a2.13 2.13 0 0 1-.885.968l-.171.088-5.158 2.343a1.125 1.125 0 0 1-1.49-1.488l2.345-5.159.087-.171c.22-.388.559-.698.968-.884l5.16-2.345ZM11.35 11.35l-1.084 2.384 2.384-1.084 1.084-2.384z"
      />
    </svg>
  );
}
