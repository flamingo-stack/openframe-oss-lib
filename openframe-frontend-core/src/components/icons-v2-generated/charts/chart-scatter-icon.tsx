import type { SVGProps } from "react";
export interface ChartScatterIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartScatterIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartScatterIconProps) {
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
        d="M16.14 14.633a1.375 1.375 0 1 1-1.508 1.507l-.008-.14.008-.141A1.375 1.375 0 0 1 16 14.626zm-7.999-1a1.375 1.375 0 1 1-1.509 1.508l-.007-.14.007-.141A1.375 1.375 0 0 1 8 13.625zm4-3a1.375 1.375 0 1 1-1.508 1.508l-.007-.14.007-.141A1.374 1.374 0 0 1 12 10.625zm7-1.001a1.376 1.376 0 1 1-1.51 1.509L17.626 11l.007-.14A1.376 1.376 0 0 1 19 9.624zm-10-4A1.374 1.374 0 1 1 7.632 7.14L7.625 7l.008-.141A1.374 1.374 0 0 1 9 5.625l.14.008Zm7-1a1.376 1.376 0 1 1-1.51 1.51L14.625 6l.008-.14A1.375 1.375 0 0 1 16 4.625z"
      />
    </svg>
  );
}
