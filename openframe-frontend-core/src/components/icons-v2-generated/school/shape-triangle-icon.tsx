import type { SVGProps } from "react";
export interface ShapeTriangleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ShapeTriangleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ShapeTriangleIconProps) {
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
        d="M8.436 3.923c1.591-2.73 5.536-2.73 7.128 0l6.993 11.995c1.603 2.75-.38 6.203-3.564 6.203H5.007c-3.184 0-5.168-3.454-3.564-6.203zm5.184 1.133c-.678-1.163-2.297-1.236-3.092-.219l-.148.219L3.386 17.05c-.728 1.25.174 2.82 1.62 2.82h13.987c1.447 0 2.349-1.57 1.62-2.82z"
      />
    </svg>
  );
}
