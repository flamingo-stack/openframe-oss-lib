import type { SVGProps } from "react";
export interface CarSideIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CarSideIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CarSideIconProps) {
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
        d="M.875 16.5V13c0-1.408.932-2.598 2.212-2.989l.754-3.019.1-.338a4.12 4.12 0 0 1 3.902-2.779h5.302c1.557 0 2.99.87 3.69 2.273l1.886 3.778a5.125 5.125 0 0 1 4.404 5.075v1.5A3.125 3.125 0 0 1 20 19.624h-.5a1.125 1.125 0 0 1 0-2.25h.5a.875.875 0 0 0 .875-.875V15A2.875 2.875 0 0 0 18 12.126H4a.875.875 0 0 0-.875.874v3.5c0 .483.392.875.875.875h.5a1.125 1.125 0 0 1 0 2.25H4A3.125 3.125 0 0 1 .875 16.5m13.624.875.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006H9.5a1.125 1.125 0 0 1 0-2.25zm-2.873-7.5h4.555l-1.36-2.722a1.87 1.87 0 0 0-1.676-1.028h-1.52zm-3.783-3.75c-.812 0-1.518.512-1.774 1.26l-.045.152-.585 2.338h3.936v-3.75z"
      />
      <path
        fill={color}
        d="M8.375 18.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m10 0a1.376 1.376 0 1 0-2.751.002 1.376 1.376 0 0 0 2.751-.002m-7.75 0a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.248 0Zm10 0a3.625 3.625 0 1 1-7.25-.001 3.625 3.625 0 0 1 7.25.002Z"
      />
    </svg>
  );
}
