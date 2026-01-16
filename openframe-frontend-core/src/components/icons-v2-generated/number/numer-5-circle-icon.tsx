import type { SVGProps } from "react";
export interface Numer5CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer5CircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer5CircleIconProps) {
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
        d="M9.401 13.374a1.126 1.126 0 0 1 1.377.614l.041.109.065.146c.188.339.626.631 1.116.631.629 0 1.125-.496 1.125-1.125v-.499c0-.61-.505-1.125-1.125-1.125-.662 0-1.103.309-1.748.631a1.125 1.125 0 0 1-1.624-1.08l.233-3.518v-.006l.016-.133c.11-.654.68-1.144 1.356-1.144h3.518l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-2.699l-.06.877A4.2 4.2 0 0 1 12 9.875c1.88 0 3.375 1.54 3.375 3.375v.5A3.366 3.366 0 0 1 12 17.124c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.308Z"
      />
    </svg>
  );
}
