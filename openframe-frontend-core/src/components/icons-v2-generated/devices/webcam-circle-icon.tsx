import type { SVGProps } from "react";
export interface WebcamCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WebcamCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: WebcamCircleIconProps) {
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
        d="M13.78 16.781a1.125 1.125 0 0 1 1.506-.077l.085.077 2.717 2.716c1.34 1.339.39 3.628-1.503 3.628h-9.17c-1.894 0-2.842-2.29-1.504-3.628l2.718-2.716a1.125 1.125 0 1 1 1.59 1.591l-2.505 2.503h8.571l-2.505-2.503-.077-.086a1.125 1.125 0 0 1 .077-1.505m-.405-6.78a1.375 1.375 0 1 0-2.75-.001 1.375 1.375 0 0 0 2.75 0Zm2.25 0A3.624 3.624 0 1 1 8.376 10a3.624 3.624 0 0 1 7.249 0Z"
      />
      <path
        fill={color}
        d="M18.875 10a6.876 6.876 0 1 0-13.751.002A6.876 6.876 0 0 0 18.876 10Zm2.25 0a9.126 9.126 0 1 1-18.25 0 9.126 9.126 0 0 1 18.25 0"
      />
    </svg>
  );
}
