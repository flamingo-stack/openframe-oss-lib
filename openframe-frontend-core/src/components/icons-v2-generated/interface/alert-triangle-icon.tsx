import type { SVGProps } from "react";
export interface AlertTriangleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlertTriangleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlertTriangleIconProps) {
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
        d="M8.436 3.923c1.591-2.73 5.536-2.73 7.128 0l6.993 11.995c1.603 2.75-.38 6.203-3.564 6.203H5.007c-3.184 0-5.168-3.453-3.564-6.203zm5.184 1.133c-.678-1.163-2.297-1.236-3.092-.218l-.148.218L3.386 17.05c-.728 1.25.174 2.82 1.62 2.82h13.987c1.447 0 2.349-1.57 1.62-2.82z"
      />
      <path
        fill={color}
        d="M10.876 13V9a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0m2.498 4a1.375 1.375 0 0 1-2.742.14l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.234l.14.008c.693.07 1.233.655 1.233 1.367"
      />
    </svg>
  );
}
