import type { SVGProps } from "react";
export interface GraphCurveArrowIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GraphCurveArrowIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: GraphCurveArrowIconProps) {
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
        d="M16.875 9V6.716l-1.08 1.08a1.125 1.125 0 0 1-1.59-1.591l3-3 .17-.141a1.125 1.125 0 0 1 1.42.14l3 3 .078.086a1.125 1.125 0 0 1-1.582 1.583l-.087-.078-1.08-1.08V9A9.124 9.124 0 0 1 10 18.125H7a1.125 1.125 0 0 1 0-2.25h3A6.875 6.875 0 0 0 16.875 9"
      />
    </svg>
  );
}
