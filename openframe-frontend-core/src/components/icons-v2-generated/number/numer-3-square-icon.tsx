import type { SVGProps } from "react";
export interface Numer3SquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer3SquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer3SquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M9.401 13.374a1.126 1.126 0 0 1 1.377.614l.041.109.065.146c.188.339.626.631 1.116.631a1.125 1.125 0 0 0 0-2.25h-.05a1.125 1.125 0 0 1 0-2.25h.1a.625.625 0 1 0 0-1.249h-.1a.63.63 0 0 0-.565.357l-.054.102a1.125 1.125 0 0 1-1.98-1.067l.094-.177a2.87 2.87 0 0 1 2.505-1.465h.1a2.876 2.876 0 0 1 2.36 4.515A3.375 3.375 0 0 1 12 17.125c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.308"
      />
    </svg>
  );
}
