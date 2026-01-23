import type { SVGProps } from "react";
export interface ExclamationIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ExclamationIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ExclamationIconProps) {
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
        d="M10.875 14.5V4a1.125 1.125 0 0 1 2.25 0v10.5a1.125 1.125 0 0 1-2.25 0m.625 4.629a.62.62 0 0 0-.124.37l.011.127c.019.09.06.172.113.244zm1 .741a.6.6 0 0 0 .112-.245l.013-.125-.013-.127a.6.6 0 0 0-.111-.244zm1.126-.37a1.625 1.625 0 0 1-3.242.167l-.009-.168.009-.165a1.625 1.625 0 0 1 1.615-1.459l.167.009c.82.083 1.46.774 1.46 1.616"
      />
    </svg>
  );
}
