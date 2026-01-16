import type { SVGProps } from "react";
export interface BitcoinIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BitcoinIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: BitcoinIconProps) {
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
        d="M7.875 22v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m3 0v-2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m-3-18V2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0m3 0V2a1.125 1.125 0 0 1 2.25 0v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M15.875 15.5a3.375 3.375 0 0 0-3.375-3.374H9.125v6.75H12.5a3.375 3.375 0 0 0 3.375-3.376m-1-8A2.375 2.375 0 0 0 12.5 5.125H9.125v4.75H12.5l.243-.013A2.375 2.375 0 0 0 14.874 7.5Zm2.25 0c0 1.323-.56 2.512-1.45 3.355a5.625 5.625 0 0 1-3.174 10.27H8.499A1.626 1.626 0 0 1 6.875 19.5v-15c0-.898.727-1.625 1.625-1.625h4A4.625 4.625 0 0 1 17.125 7.5"
      />
    </svg>
  );
}
