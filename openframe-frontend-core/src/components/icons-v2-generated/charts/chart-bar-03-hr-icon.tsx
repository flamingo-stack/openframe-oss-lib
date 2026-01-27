import type { SVGProps } from "react";
export interface ChartBar03HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBar03HrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartBar03HrIconProps) {
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
        d="M4.125 12.676h15.75v-1.351H4.125v1.35Zm18 .124A2.126 2.126 0 0 1 20 14.926H4A2.126 2.126 0 0 1 1.875 12.8v-1.6c0-1.173.952-2.125 2.125-2.125h16c1.173 0 2.125.952 2.125 2.126z"
      />
      <path
        fill={color}
        d="M4.125 12.676h15.75v-1.351H4.125v1.35Zm18 .124A2.126 2.126 0 0 1 20 14.926H4A2.126 2.126 0 0 1 1.875 12.8v-1.6c0-1.173.952-2.125 2.125-2.125h16c1.173 0 2.125.952 2.125 2.126zm-18 7.075h7.75v-1.35h-7.75zm0-14.4h11.75v-1.35H4.124v1.35Zm10 14.525A2.126 2.126 0 0 1 12 22.125H4A2.126 2.126 0 0 1 1.875 20v-1.6c0-1.174.952-2.126 2.125-2.126h8c1.174 0 2.125.952 2.126 2.126zm4-14.4A2.127 2.127 0 0 1 16 7.726H4A2.126 2.126 0 0 1 1.875 5.6V4c0-1.173.952-2.125 2.125-2.125h12c1.174 0 2.125.952 2.125 2.125z"
      />
      <path
        fill={color}
        d="M4.125 19.875h7.75v-1.35h-7.75zm0-14.4h11.75v-1.35H4.124v1.35Zm10 14.525A2.126 2.126 0 0 1 12 22.125H4A2.126 2.126 0 0 1 1.875 20v-1.6c0-1.174.952-2.126 2.125-2.126h8c1.174 0 2.125.952 2.126 2.126zm4-14.4A2.127 2.127 0 0 1 16 7.726H4A2.126 2.126 0 0 1 1.875 5.6V4c0-1.173.952-2.125 2.125-2.125h12c1.174 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
