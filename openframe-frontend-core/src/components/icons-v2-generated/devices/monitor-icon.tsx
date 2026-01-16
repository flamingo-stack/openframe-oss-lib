import type { SVGProps } from "react";
export interface MonitorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MonitorIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MonitorIconProps) {
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
        d="M10.876 17a1.125 1.125 0 0 1 2.25 0v2.875h2.873l.116.006a1.125 1.125 0 0 1 0 2.239l-.115.005H8a1.125 1.125 0 0 1 0-2.25h2.876z"
      />
      <path
        fill={color}
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h14a1.875 1.875 0 0 0 1.875-1.875zm2.25 8A4.125 4.125 0 0 1 19 18.124H5a4.125 4.125 0 0 1-4.125-4.126V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
    </svg>
  );
}
