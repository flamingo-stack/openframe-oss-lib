import type { SVGProps } from "react";
export interface Gauge02IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Gauge02Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Gauge02IconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M4.375 12a7.625 7.625 0 0 1 9.265-7.448 1.126 1.126 0 0 1-.482 2.198 5.375 5.375 0 0 0-5.395 8.558 1.125 1.125 0 0 1-1.774 1.385 7.6 7.6 0 0 1-1.614-4.694Zm13 0q-.002-.6-.125-1.158l2.198-.483q.175.797.177 1.64a7.6 7.6 0 0 1-1.615 4.694 1.125 1.125 0 0 1-1.773-1.386A5.35 5.35 0 0 0 17.376 12Zm-1.67-5.296a1.125 1.125 0 0 1 1.59 1.59l-3.226 3.226a2.126 2.126 0 1 1-4.184.697L9.876 12l.01-.216A2.125 2.125 0 0 1 12 9.875l.219.01q.132.015.26.045zm2.403 2.798a1.125 1.125 0 0 1 1.34.857l-2.198.483a1.126 1.126 0 0 1 .858-1.34"
      />
    </svg>
  );
}
