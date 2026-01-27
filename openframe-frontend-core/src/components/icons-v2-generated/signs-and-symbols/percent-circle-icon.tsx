import type { SVGProps } from "react";
export interface PercentCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PercentCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PercentCircleIconProps) {
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
        d="M14.705 7.705a1.125 1.125 0 0 1 1.59 1.59l-7 7a1.125 1.125 0 0 1-1.59-1.59zm-.205 6.924a.62.62 0 0 0-.124.37l.011.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.244l.013-.127-.013-.126a.6.6 0 0 0-.111-.244zm-7-6.741a.62.62 0 0 0-.125.37l.012.126a.6.6 0 0 0 .113.245zm1 .741a.6.6 0 0 0 .112-.245L9.625 9l-.013-.126a.6.6 0 0 0-.112-.245zM16.625 15a1.625 1.625 0 0 1-3.242.167l-.008-.168.009-.165a1.625 1.625 0 0 1 1.615-1.459l.167.009c.82.083 1.46.774 1.46 1.615Zm-6-6a1.625 1.625 0 0 1-3.242.167L7.376 9l.009-.166A1.625 1.625 0 0 1 9 7.375l.166.009c.82.083 1.46.774 1.46 1.616Z"
      />
    </svg>
  );
}
