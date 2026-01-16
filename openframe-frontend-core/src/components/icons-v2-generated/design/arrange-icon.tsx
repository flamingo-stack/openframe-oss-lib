import type { SVGProps } from "react";
export interface ArrangeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrangeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ArrangeIconProps) {
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
        d="M15.998 6.625H8a1.125 1.125 0 0 1 0-2.25h8l.115.006a1.122 1.122 0 0 1 .172 2.202 1.125 1.125 0 0 1 .801 1.92l-8.585 8.585a1.1 1.1 0 0 1-.507.287h10.289l-.58-.58-.078-.085a1.125 1.125 0 0 1 1.584-1.583l.085.078 2.5 2.5a1.127 1.127 0 0 1 0 1.59l-2.5 2.5a1.125 1.125 0 1 1-1.591-1.59l.578-.58H8a1.122 1.122 0 0 1-.293-2.207 1.125 1.125 0 0 1-.795-1.92l8.585-8.586a1.1 1.1 0 0 1 .501-.287"
      />
      <path
        fill={color}
        d="M4.125 19.875h2.75v-2.75h-2.75zm13-13h2.75v-2.75h-2.75zm-13 0h2.75v-2.75h-2.75zm5 13.125A2.125 2.125 0 0 1 7 22.125H4A2.126 2.126 0 0 1 1.875 20v-3c0-1.174.952-2.124 2.125-2.124h3c1.174 0 2.124.95 2.125 2.124zm0-13A2.125 2.125 0 0 1 7 9.125H4A2.125 2.125 0 0 1 1.875 7V4c0-1.173.952-2.125 2.125-2.125h3c1.174 0 2.125.952 2.125 2.125zm13 0A2.125 2.125 0 0 1 20 9.125h-3A2.124 2.124 0 0 1 14.876 7V4c0-1.173.95-2.125 2.124-2.125h3c1.173 0 2.125.952 2.125 2.125z"
      />
    </svg>
  );
}
