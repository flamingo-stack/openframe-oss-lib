import type { SVGProps } from "react";
export interface MonitorAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MonitorAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MonitorAltIconProps) {
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
        d="m16 19.875.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006H8a1.125 1.125 0 0 1 0-2.25zm6-8 .115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h14a1.875 1.875 0 0 0 1.875-1.875zm2.25 8A4.125 4.125 0 0 1 19 18.124H5a4.125 4.125 0 0 1-4.125-4.126V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
    </svg>
  );
}
