import type { SVGProps } from "react";
export interface BikingIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BikingIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BikingIconProps) {
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
        d="M7.875 17.5a2.376 2.376 0 1 0-4.751.002 2.376 2.376 0 0 0 4.751-.002m13 0a2.375 2.375 0 1 0-4.75 0 2.375 2.375 0 0 0 4.75 0m-10.75 0a4.626 4.626 0 1 1-9.25 0 4.626 4.626 0 0 1 9.25 0m13 0a4.625 4.625 0 1 1-9.251 0 4.625 4.625 0 0 1 9.25 0Z"
      />
      <path
        fill={color}
        d="M11.244 6.265a2.13 2.13 0 0 1 2.682 0l.163.147 1.963 1.963H19l.115.005a1.126 1.126 0 0 1 0 2.239l-.114.005h-3c-.494 0-.97-.17-1.348-.48l-.155-.14-1.913-1.914-2.409 2.409 2.827 2.827.175.199c.322.415.48.935.442 1.459l-.036.262-.896 4.475a1.124 1.124 0 1 1-2.206-.442l.882-4.41-2.866-2.866a2.126 2.126 0 0 1 0-3.006l2.585-2.585zm3.257-3.138a.62.62 0 0 0-.127.373l.014.125a.6.6 0 0 0 .113.247zm.998.745a.6.6 0 0 0 .113-.247l.014-.125-.014-.126a.6.6 0 0 0-.113-.247zm1.126-.372a1.625 1.625 0 0 1-3.242.167l-.007-.167.007-.166A1.626 1.626 0 0 1 15 1.875l.165.009c.82.083 1.46.774 1.46 1.616"
      />
    </svg>
  );
}
