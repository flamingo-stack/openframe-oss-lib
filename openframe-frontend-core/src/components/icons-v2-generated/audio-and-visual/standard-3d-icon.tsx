import type { SVGProps } from "react";
export interface Standard3dIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Standard3dIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Standard3dIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M5.401 13.374a1.126 1.126 0 0 1 1.377.614l.041.109.065.146c.188.339.626.631 1.116.631a1.125 1.125 0 0 0 0-2.25h-.05a1.125 1.125 0 0 1 0-2.25h.1a.625.625 0 1 0 0-1.249h-.1a.63.63 0 0 0-.565.357l-.054.102a1.125 1.125 0 0 1-1.98-1.067l.094-.177A2.87 2.87 0 0 1 7.95 6.875h.1a2.876 2.876 0 0 1 2.36 4.515A3.375 3.375 0 0 1 8 17.125c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.308m11.974-2.873c0-.76-.616-1.376-1.376-1.376h-.874v5.75h.874c.76 0 1.376-.615 1.376-1.374zm2.25 3a3.625 3.625 0 0 1-3.626 3.624h-1.748c-.76 0-1.376-.615-1.376-1.374v-7.5c0-.76.616-1.376 1.376-1.376h1.748a3.626 3.626 0 0 1 3.626 3.626z"
      />
    </svg>
  );
}
