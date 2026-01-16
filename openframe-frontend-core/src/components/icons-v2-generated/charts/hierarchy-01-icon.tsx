import type { SVGProps } from "react";
export interface Hierarchy01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Hierarchy01Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Hierarchy01IconProps) {
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
        d="M18.875 17v-2c0-1.036-.84-1.875-1.875-1.876h-3.876V17a1.125 1.125 0 0 1-2.25 0v-3.876H7c-1.035 0-1.875.84-1.875 1.875V17a1.125 1.125 0 0 1-2.25 0v-2A4.125 4.125 0 0 1 7 10.873h3.874V7a1.125 1.125 0 0 1 2.25 0v3.874H17A4.126 4.126 0 0 1 21.125 15v2a1.126 1.126 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.125 19.875h1.75v-1.75h-1.75zm-8 0h1.75v-1.75h-1.75zm-8 0h1.75v-1.75h-1.75zm8-14h1.75v-1.75h-1.75zM7.124 20A2.126 2.126 0 0 1 5 22.125H3A2.126 2.126 0 0 1 .875 20v-2c0-1.174.952-2.126 2.125-2.126h2c1.174 0 2.125.952 2.125 2.126v2Zm8 0a2.126 2.126 0 0 1-2.126 2.125H11A2.126 2.126 0 0 1 8.875 20v-2c0-1.174.951-2.126 2.125-2.126h2c1.173 0 2.125.952 2.125 2.126zm8 0a2.125 2.125 0 0 1-2.125 2.125h-2A2.125 2.125 0 0 1 16.875 20v-2c0-1.173.951-2.125 2.125-2.126h2c1.174 0 2.125.953 2.125 2.126v2Zm-8-14a2.126 2.126 0 0 1-2.126 2.125H11A2.126 2.126 0 0 1 8.875 6V4c0-1.173.951-2.125 2.125-2.125h2c1.173 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
