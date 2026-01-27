import type { SVGProps } from "react";
export interface MonitorChartIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MonitorChartIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MonitorChartIconProps) {
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
        d="M10.875 17a1.125 1.125 0 0 1 2.25 0v2.875H16l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H8a1.125 1.125 0 0 1 0-2.25h2.875zm4.83-10.295a1.125 1.125 0 1 1 1.59 1.59l-2.698 2.699c-.69.689-1.76.82-2.595.319l-1.079-.646-2.628 2.628a1.125 1.125 0 1 1-1.59-1.59l2.698-2.698.133-.123A2.13 2.13 0 0 1 11.84 8.6l.16.088 1.076.645z"
      />
      <path
        fill={color}
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h14a1.875 1.875 0 0 0 1.875-1.875zm2.25 8A4.125 4.125 0 0 1 19 18.124H5a4.125 4.125 0 0 1-4.125-4.126V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
    </svg>
  );
}
