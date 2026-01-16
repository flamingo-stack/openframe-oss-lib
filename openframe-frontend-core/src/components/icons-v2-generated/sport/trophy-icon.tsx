import type { SVGProps } from "react";
export interface TrophyIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrophyIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrophyIconProps) {
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
        d="M10.876 18v-3a1.125 1.125 0 0 1 2.25 0v3a1.125 1.125 0 0 1-2.25 0M.875 6.5v-2c0-.898.727-1.625 1.625-1.625H6l.115.006a1.126 1.126 0 0 1 0 2.238L6 5.125H3.125V6.5a2.875 2.875 0 0 0 2.581 2.86L6 9.375l.115.005a1.126 1.126 0 0 1 0 2.239L6 11.624l-.263-.005A5.126 5.126 0 0 1 .875 6.5m22.25 0A5.124 5.124 0 0 1 18 11.624a1.125 1.125 0 0 1 0-2.25A2.874 2.874 0 0 0 20.875 6.5V5.125H18a1.125 1.125 0 0 1 0-2.25h3.5c.897 0 1.624.727 1.625 1.625z"
      />
      <path
        fill={color}
        d="M10.5 19.125c-.993 0-1.803.773-1.868 1.75h6.736a1.87 1.87 0 0 0-1.868-1.75zm6.375-16h-9.75V9a4.875 4.875 0 0 0 9.75 0zm.75 18.375c0 .897-.727 1.624-1.625 1.625H8A1.625 1.625 0 0 1 6.375 21.5V21a4.125 4.125 0 0 1 4.125-4.125h3A4.125 4.125 0 0 1 17.625 21zm1.5-12.5a7.125 7.125 0 0 1-14.25 0V2.5c0-.898.727-1.625 1.625-1.625h11c.898 0 1.625.727 1.625 1.625z"
      />
    </svg>
  );
}
