import type { SVGProps } from "react";
export interface Scale02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Scale02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Scale02IconProps) {
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
        d="M11.565 14.89a1.125 1.125 0 0 1 1.27.812l.025.113.25 1.5a1.125 1.125 0 0 1-2.22.37l-.25-1.5-.014-.115a1.126 1.126 0 0 1 .94-1.18Zm3.31 1.11a2.874 2.874 0 0 0-5.75 0 1.125 1.125 0 0 1-2.25 0 5.125 5.125 0 0 1 10.25 0 1.125 1.125 0 0 1-2.25 0m-2-7.231V6.125h-1.75v2.644a1.125 1.125 0 0 1-2.25 0V6.125H7.736a3.13 3.13 0 0 1-2.795-1.727l-.947-1.896A1.126 1.126 0 0 1 5 .875h14a1.125 1.125 0 0 1 1.006 1.627l-.946 1.896a3.13 3.13 0 0 1-2.795 1.727h-1.14v2.644a1.125 1.125 0 0 1-2.25 0m-5.92-5.377a.88.88 0 0 0 .781.483h8.529a.88.88 0 0 0 .782-.483l.133-.267H6.82z"
      />
      <path
        fill={color}
        d="M18.375 16a6.375 6.375 0 0 0-12.75 0v3.5c0 .207.168.375.375.375h12a.375.375 0 0 0 .375-.375zm2.25 3.5A2.625 2.625 0 0 1 18 22.125H6A2.625 2.625 0 0 1 3.375 19.5V16a8.625 8.625 0 1 1 17.25 0z"
      />
    </svg>
  );
}
