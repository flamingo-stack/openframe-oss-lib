import type { SVGProps } from "react";
export interface CalendarLockIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CalendarLockIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CalendarLockIconProps) {
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
        d="M21 6.875a1.125 1.125 0 0 1 0 2.25H3a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M17.125 20.875h3.75v-1.75h-3.75zm2.75-10.512V6c0-.996-.778-1.81-1.76-1.87a1.124 1.124 0 0 1-2.233-.005H8.118a1.125 1.125 0 0 1-2.235.005A1.874 1.874 0 0 0 4.125 6v12c0 1.036.84 1.875 1.875 1.875h6.101l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H6A4.125 4.125 0 0 1 1.875 18V6a4.12 4.12 0 0 1 4.006-4.119 1.125 1.125 0 0 1 2.237-.006h7.764a1.125 1.125 0 0 1 2.235.006 4.12 4.12 0 0 1 4.008 4.12v4.362a1.125 1.125 0 0 1-2.25 0m-.25 5.388a.625.625 0 1 0-1.25 0v1.124h1.25zm2.25 1.313A2.12 2.12 0 0 1 23.125 19v2A2.125 2.125 0 0 1 21 23.125h-4A2.124 2.124 0 0 1 14.876 21v-2c0-.862.512-1.602 1.249-1.936v-1.313a2.876 2.876 0 0 1 5.75 0z"
      />
    </svg>
  );
}
