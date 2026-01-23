import type { SVGProps } from "react";
export interface CalendarOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CalendarOffIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CalendarOffIconProps) {
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
        d="M19.875 15.346V9.125h-6.222a1.125 1.125 0 0 1 0-2.25h6.222V6c0-.996-.778-1.81-1.759-1.87a1.124 1.124 0 0 1-2.234-.005H8.653a1.125 1.125 0 0 1 0-2.25h7.23a1.125 1.125 0 0 1 2.234.006 4.12 4.12 0 0 1 4.008 4.12v9.345a1.125 1.125 0 0 1-2.25 0M1.205 1.205a1.125 1.125 0 0 1 1.505-.078l.085.078 20 19.999.078.087a1.124 1.124 0 0 1-1.582 1.581l-.087-.077-1.195-1.196a4.1 4.1 0 0 1-2.009.526H6A4.125 4.125 0 0 1 1.875 18V6c0-.729.191-1.415.523-2.01L1.205 2.796l-.078-.085a1.125 1.125 0 0 1 .078-1.505ZM4.125 18c0 1.036.84 1.875 1.875 1.875h12c.09 0 .177-.01.263-.022L7.534 9.125H4.125zm0-11.125h1.16l-1.14-1.138a2 2 0 0 0-.02.263z"
      />
    </svg>
  );
}
