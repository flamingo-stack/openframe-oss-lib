import type { SVGProps } from "react";
export interface TrainTunnelIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrainTunnelIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrainTunnelIconProps) {
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
        d="M20.875 22V12a8.875 8.875 0 1 0-17.75 0v10a1.125 1.125 0 0 1-2.25 0V12C.875 5.857 5.856.876 12.001.876c6.143 0 11.124 4.981 11.124 11.126V22a1.125 1.125 0 0 1-2.25 0m-4.5-6.5a1.375 1.375 0 0 1-2.743.14l-.007-.14.007-.14a1.376 1.376 0 0 1 1.369-1.236l.14.008c.693.07 1.234.656 1.234 1.368M18 11.375l.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H6a1.125 1.125 0 0 1 0-2.25zM10.374 15.5a1.375 1.375 0 0 1-2.742.14l-.007-.14.007-.14A1.376 1.376 0 0 1 9 14.123l.141.008c.693.07 1.233.656 1.233 1.368Z"
      />
      <path
        fill={color}
        d="M16.875 9A.875.875 0 0 0 16 8.125H8A.875.875 0 0 0 7.125 9v7.5c0 .483.391.875.875.875h8a.876.876 0 0 0 .875-.875zm-8.74 11.375h7.73l-.213-.75H8.348zm10.99-3.875a3.12 3.12 0 0 1-1.304 2.534l.618 2.157.142.5.027.113a1.122 1.122 0 0 1-2.038.822H7.43a1.122 1.122 0 0 1-2.012-.935l.143-.5.616-2.157A3.12 3.12 0 0 1 4.875 16.5V9A3.125 3.125 0 0 1 8 5.875h8A3.125 3.125 0 0 1 19.125 9z"
      />
    </svg>
  );
}
