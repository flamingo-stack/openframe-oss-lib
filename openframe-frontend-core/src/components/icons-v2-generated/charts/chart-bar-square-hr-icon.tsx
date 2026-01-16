import type { SVGProps } from "react";
export interface ChartBarSquareHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBarSquareHrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ChartBarSquareHrIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="m13.5 14.874.115.006a1.125 1.125 0 0 1 0 2.239l-.116.006H7a1.125 1.125 0 0 1 0-2.25zm3.5-3.998.115.005a1.126 1.126 0 0 1 0 2.239l-.114.006H7a1.125 1.125 0 0 1 0-2.25zm-6-4.001.115.006a1.125 1.125 0 0 1 0 2.238L11 9.125H7a1.125 1.125 0 0 1 0-2.25z"
      />
    </svg>
  );
}
