import type { SVGProps } from "react";
export interface PowerCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PowerCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PowerCircleIconProps) {
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
        d="M5.875 12c0-1.378.457-2.652 1.226-3.676A1.125 1.125 0 1 1 8.9 9.674a3.876 3.876 0 1 0 6.373.25l-.172-.25-.065-.094a1.125 1.125 0 0 1 1.79-1.345l.073.09.274.395A6.127 6.127 0 0 1 12 18.126a6.126 6.126 0 0 1-6.124-6.127Zm5 0V7a1.125 1.125 0 0 1 2.25 0v5a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
