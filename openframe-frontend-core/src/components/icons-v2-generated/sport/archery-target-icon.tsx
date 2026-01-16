import type { SVGProps } from "react";
export interface ArcheryTargetIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArcheryTargetIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArcheryTargetIconProps) {
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
        d="M16.375 12a4.375 4.375 0 1 0-8.75 0 4.375 4.375 0 0 0 8.75 0m2.25 0a6.625 6.625 0 1 1-13.25-.002 6.625 6.625 0 0 1 13.25.002"
      />
      <path
        fill={color}
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0M12 11.875a.127.127 0 0 0-.127.127l.01.048a.125.125 0 0 0 .23 0l.011-.048-.01-.05a.13.13 0 0 0-.066-.066zm2.123.127a2.124 2.124 0 0 1-4.239.216l-.01-.216.01-.219A2.126 2.126 0 0 1 12 9.876l.216.01a2.126 2.126 0 0 1 1.907 2.116m9 0c0 6.143-4.98 11.123-11.123 11.124C5.856 23.125.875 18.145.875 12S5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
    </svg>
  );
}
