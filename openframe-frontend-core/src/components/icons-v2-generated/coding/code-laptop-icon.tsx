import type { SVGProps } from "react";
export interface CodeLaptopIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CodeLaptopIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CodeLaptopIconProps) {
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
        d="M3.132 18.125c.065.977.874 1.75 1.868 1.75h14c.993 0 1.805-.773 1.869-1.75h-5.403l-.378.377a2.12 2.12 0 0 1-1.503.623h-3.17a2.13 2.13 0 0 1-1.504-.623l-.376-.377zm6.072-10.67a1.125 1.125 0 0 1 1.59 1.59L9.34 10.5l1.455 1.455.078.085a1.125 1.125 0 0 1-1.582 1.583l-.087-.078-2.25-2.25a1.125 1.125 0 0 1 0-1.59zm4 0a1.125 1.125 0 0 1 1.506-.078l.085.078 2.25 2.25a1.125 1.125 0 0 1 0 1.59l-2.25 2.25a1.125 1.125 0 1 1-1.59-1.59l1.454-1.455-1.454-1.455-.078-.085a1.125 1.125 0 0 1 .078-1.505ZM23.125 18A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18c0-1.174.952-2.126 2.125-2.126h5.586c.493 0 .968.173 1.346.482l.157.141.376.378h3.07l.377-.378.155-.14c.378-.31.854-.482 1.347-.482H21c1.174 0 2.125.952 2.125 2.125"
      />
    </svg>
  );
}
