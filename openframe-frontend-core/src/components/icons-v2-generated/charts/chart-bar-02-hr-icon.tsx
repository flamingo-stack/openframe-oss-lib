import type { SVGProps } from "react";
export interface ChartBar02HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBar02HrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartBar02HrIconProps) {
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
        d="M4.125 19.876h15.75v-1.35H4.125zm18 .124A2.126 2.126 0 0 1 20 22.126H4A2.126 2.126 0 0 1 1.875 20v-1.6c0-1.173.952-2.125 2.125-2.125h16c1.173 0 2.125.952 2.125 2.126zm-18-7.325h11.75v-1.35H4.124v1.35Zm0-7.2h7.75v-1.35h-7.75zm14 7.325A2.125 2.125 0 0 1 16 14.925H4A2.126 2.126 0 0 1 1.875 12.8v-1.6c0-1.173.952-2.125 2.125-2.125h12c1.174 0 2.125.952 2.125 2.125zm-4-7.2A2.126 2.126 0 0 1 12 7.726H4A2.126 2.126 0 0 1 1.875 5.6V4c0-1.173.952-2.125 2.125-2.125h8c1.174 0 2.126.952 2.126 2.125z"
      />
    </svg>
  );
}
