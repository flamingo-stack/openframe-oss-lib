import type { SVGProps } from "react";
export interface TerminalLaptopIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TerminalLaptopIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TerminalLaptopIconProps) {
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
        d="M3.132 18.125A1.87 1.87 0 0 0 5 19.875h14c.993 0 1.804-.773 1.869-1.75h-5.403l-.378.377a2.12 2.12 0 0 1-1.503.623h-3.17a2.12 2.12 0 0 1-1.347-.481l-.157-.142-.376-.377zm3.072-10.42a1.126 1.126 0 0 1 1.506-.078l.085.078 2.25 2.25a1.125 1.125 0 0 1 0 1.59l-2.25 2.25a1.125 1.125 0 0 1-1.59-1.59l1.454-1.455-1.455-1.455-.076-.085a1.125 1.125 0 0 1 .076-1.505M17 11.875l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-4a1.125 1.125 0 0 1 0-2.25zM23.125 18A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18c0-1.174.952-2.124 2.125-2.124h5.586c.493 0 .968.17 1.346.48l.157.142.376.377h3.07l.377-.377.155-.142c.378-.31.854-.48 1.347-.48H21c1.174 0 2.124.95 2.125 2.124"
      />
    </svg>
  );
}
