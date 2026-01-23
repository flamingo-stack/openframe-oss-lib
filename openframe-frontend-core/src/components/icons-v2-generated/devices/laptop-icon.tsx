import type { SVGProps } from "react";
export interface LaptopIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LaptopIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: LaptopIconProps) {
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
        d="M19.875 17V7c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v10a1.125 1.125 0 0 1-2.25 0V7A4.125 4.125 0 0 1 6 2.875h12A4.125 4.125 0 0 1 22.125 7v10a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M3.132 18.125c.065.977.875 1.75 1.868 1.75h14c.993 0 1.804-.773 1.869-1.75h-5.403l-.378.378a2.13 2.13 0 0 1-1.503.622h-3.17c-.494 0-.97-.172-1.347-.481l-.157-.141-.376-.378zM23.124 18A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18c0-1.173.952-2.125 2.125-2.125h5.586c.493 0 .968.172 1.346.482l.157.14.376.378h3.07l.377-.377.155-.141c.378-.31.854-.482 1.347-.482H21c1.174 0 2.125.952 2.125 2.125Z"
      />
    </svg>
  );
}
