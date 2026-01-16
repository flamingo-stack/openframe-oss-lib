import type { SVGProps } from "react";
export interface PantsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PantsIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PantsIconProps) {
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
        d="M10.389.884c.616.077 1.054.639.977 1.255l-.42 3.372A4.126 4.126 0 0 1 6.85 9.125h-1.2a1.125 1.125 0 0 1 0-2.25h1.201c.946 0 1.743-.704 1.86-1.642l.422-3.372A1.125 1.125 0 0 1 10.39.884Zm3.221 0c.617-.077 1.18.36 1.257.977l.42 3.372.031.173c.188.85.945 1.469 1.831 1.469h1.191l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-1.191a4.126 4.126 0 0 1-4.028-3.233l-.066-.38-.422-3.373A1.126 1.126 0 0 1 13.61.884"
      />
      <path
        fill={color}
        d="M17.095.875c1.088 0 2.116.806 2.121 2.019l.9 18h-.002c.12 1.293-.945 2.23-2.12 2.23h-2.7a2.125 2.125 0 0 1-2.072-1.653l-1.225-5.392-1.224 5.392A2.125 2.125 0 0 1 8.7 23.125H6a2.124 2.124 0 0 1-2.12-2.231l.899-18 .02-.208A2.126 2.126 0 0 1 6.901.875zm-10.963 20H8.6l2.3-10.124.059-.185a1.126 1.126 0 0 1 2.136.185l2.3 10.124h2.468l-.888-17.75H7.02z"
      />
    </svg>
  );
}
