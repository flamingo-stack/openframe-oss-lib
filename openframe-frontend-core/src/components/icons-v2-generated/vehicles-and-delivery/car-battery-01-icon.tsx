import type { SVGProps } from "react";
export interface CarBattery01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CarBattery01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CarBattery01IconProps) {
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
        d="M5.875 12v-.875H5a1.125 1.125 0 0 1 0-2.25h.875V8a1.125 1.125 0 0 1 2.25 0v.875H9a1.125 1.125 0 0 1 0 2.25h-.875v.874a1.125 1.125 0 0 1-2.25 0ZM19 8.874a1.125 1.125 0 0 1 0 2.25h-4a1.125 1.125 0 0 1 0-2.25zm-10.5-6c.62 0 1.125.504 1.125 1.125v1a1.125 1.125 0 0 1-2.243.125h-.765A1.125 1.125 0 0 1 4.375 5V4l.005-.116A1.126 1.126 0 0 1 5.5 2.875zm10 0c.621 0 1.125.504 1.125 1.125v1a1.125 1.125 0 0 1-2.243.125h-.764A1.125 1.125 0 0 1 14.375 5V4l.006-.116A1.125 1.125 0 0 1 15.5 2.875z"
      />
      <path
        fill={color}
        d="M20.875 8c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v9c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 9A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V8A4.125 4.125 0 0 1 5 3.875h14A4.125 4.125 0 0 1 23.125 8z"
      />
    </svg>
  );
}
