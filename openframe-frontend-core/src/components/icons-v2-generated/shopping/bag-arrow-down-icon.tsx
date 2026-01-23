import type { SVGProps } from "react";
export interface BagArrowDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BagArrowDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BagArrowDownIconProps) {
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
        d="M10.875 11a1.125 1.125 0 0 1 2.25 0v3.284l1.08-1.08a1.125 1.125 0 0 1 1.59 1.591l-3 3c-.439.44-1.15.44-1.59 0l-3-3-.078-.085a1.125 1.125 0 0 1 1.582-1.583l.087.078 1.08 1.08V11Zm4-5a2.875 2.875 0 1 0-5.75 0 1.125 1.125 0 0 1-2.25 0 5.126 5.126 0 0 1 10.25 0 1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.877 4.875a4.125 4.125 0 0 1 4.117 3.867l.625 10a4.126 4.126 0 0 1-4.118 4.383H5.498a4.125 4.125 0 0 1-4.116-4.382l.624-10a4.126 4.126 0 0 1 4.117-3.868zM6.123 7.125c-.99 0-1.81.77-1.872 1.758l-.624 10a1.875 1.875 0 0 0 1.87 1.992h13.004c1.082 0 1.94-.912 1.872-1.992l-.625-10a1.875 1.875 0 0 0-1.87-1.758H6.122Z"
      />
    </svg>
  );
}
