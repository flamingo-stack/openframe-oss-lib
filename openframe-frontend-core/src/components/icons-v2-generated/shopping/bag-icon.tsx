import type { SVGProps } from "react";
export interface BagIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BagIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BagIconProps) {
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
        d="M17.375 10a1.376 1.376 0 0 1-2.743.14l-.008-.14.008-.141A1.375 1.375 0 0 1 16 8.625l.14.008c.694.07 1.235.655 1.235 1.367m-2.5-4a2.876 2.876 0 0 0-5.75 0 1.126 1.126 0 0 1-2.25 0 5.125 5.125 0 1 1 10.25 0 1.125 1.125 0 0 1-2.25 0m-5.5 4a1.375 1.375 0 0 1-2.743.14L6.625 10l.007-.141A1.375 1.375 0 0 1 8 8.625l.14.008c.694.07 1.234.655 1.234 1.367Z"
      />
      <path
        fill={color}
        d="M17.877 4.875a4.125 4.125 0 0 1 4.117 3.867l.625 10a4.126 4.126 0 0 1-4.118 4.383H5.498a4.125 4.125 0 0 1-4.116-4.382l.624-10a4.126 4.126 0 0 1 4.117-3.868zM6.123 7.125c-.99 0-1.81.77-1.872 1.758l-.624 10a1.875 1.875 0 0 0 1.87 1.992h13.004c1.082 0 1.94-.912 1.872-1.992l-.625-10a1.875 1.875 0 0 0-1.87-1.758H6.122Z"
      />
    </svg>
  );
}
