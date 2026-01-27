import type { SVGProps } from "react";
export interface PasscodeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PasscodeIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PasscodeIconProps) {
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
        d="M.875 13V9A4.125 4.125 0 0 1 5 4.875h14c1.52 0 2.847.823 3.562 2.043l.135.25.045.106a1.125 1.125 0 0 1-2.004.995l-.057-.101-.13-.223A1.87 1.87 0 0 0 19 7.125H5c-1.036 0-1.875.84-1.875 1.875v4c0 1.036.84 1.876 1.875 1.876h7l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.005H5a4.125 4.125 0 0 1-4.125-4.124Z"
      />
      <path
        fill={color}
        d="M17.125 17.875h3.75v-1.75h-3.75zM6.14 9.632a1.375 1.375 0 1 1-1.509 1.51L4.625 11l.007-.141A1.375 1.375 0 0 1 6 9.625l.141.007Zm4 0a1.375 1.375 0 1 1-1.508 1.51L8.625 11l.008-.141A1.375 1.375 0 0 1 10 9.625zm4 0a1.376 1.376 0 1 1-1.51 1.51L12.625 11l.008-.141A1.375 1.375 0 0 1 14 9.625zm5.484 3.117a.625.625 0 0 0-1.25 0v1.125h1.25zm2.25 1.314A2.12 2.12 0 0 1 23.125 16v2A2.125 2.125 0 0 1 21 20.125h-4A2.126 2.126 0 0 1 14.874 18v-2c0-.862.514-1.603 1.251-1.937V12.75a2.874 2.874 0 0 1 5.75 0v1.314Z"
      />
    </svg>
  );
}
