import type { SVGProps } from "react";
export interface BagMinusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BagMinusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BagMinusIconProps) {
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
        d="m15 12.875.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H9a1.125 1.125 0 0 1 0-2.25zM14.874 6a2.875 2.875 0 1 0-5.75 0 1.125 1.125 0 0 1-2.25 0 5.126 5.126 0 0 1 10.25 0 1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.877 4.875a4.125 4.125 0 0 1 4.117 3.867l.625 10a4.126 4.126 0 0 1-4.118 4.383H5.498a4.125 4.125 0 0 1-4.116-4.382l.624-10a4.126 4.126 0 0 1 4.117-3.868zM6.123 7.125c-.99 0-1.81.77-1.872 1.758l-.624 10a1.875 1.875 0 0 0 1.87 1.992h13.004c1.082 0 1.94-.912 1.872-1.992l-.625-10a1.875 1.875 0 0 0-1.87-1.758H6.122Z"
      />
    </svg>
  );
}
