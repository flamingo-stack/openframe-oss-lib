import type { SVGProps } from "react";
export interface ChartBar01HrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChartBar01HrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChartBar01HrIconProps) {
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
        d="M4.125 5.476h15.75V4.125H4.125v1.35Zm18 .124A2.126 2.126 0 0 1 20 7.726H4A2.126 2.126 0 0 1 1.875 5.6V4c0-1.173.952-2.125 2.125-2.125h16c1.173 0 2.125.952 2.125 2.125zm-18 14.275h7.75v-1.35h-7.75zm0-7.2h11.75v-1.35H4.124v1.35Zm10 7.325A2.126 2.126 0 0 1 12 22.125H4A2.126 2.126 0 0 1 1.875 20v-1.6c0-1.173.952-2.125 2.125-2.125h8c1.174 0 2.126.952 2.126 2.125zm4-7.2A2.125 2.125 0 0 1 16 14.925H4A2.126 2.126 0 0 1 1.875 12.8v-1.6c0-1.173.952-2.125 2.125-2.125h12c1.174 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
