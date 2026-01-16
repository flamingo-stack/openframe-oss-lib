import type { SVGProps } from "react";
export interface Numer3CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer3CircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer3CircleIconProps) {
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
        d="M9.401 13.374a1.126 1.126 0 0 1 1.377.614l.041.109.065.146c.188.339.626.631 1.116.631a1.125 1.125 0 0 0 0-2.25h-.05a1.125 1.125 0 0 1 0-2.25h.1a.625.625 0 1 0 0-1.249h-.1a.63.63 0 0 0-.565.357l-.054.102a1.125 1.125 0 0 1-1.98-1.067l.094-.177a2.87 2.87 0 0 1 2.505-1.465h.1a2.876 2.876 0 0 1 2.36 4.515A3.375 3.375 0 0 1 12 17.125c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.308"
      />
    </svg>
  );
}
