import type { SVGProps } from "react";
export interface Numer6CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer6CircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Numer6CircleIconProps) {
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
        d="M13.125 13.5a1.125 1.125 0 0 0-2.25 0v.25a1.125 1.125 0 0 0 2.25 0zm2.25.25a3.375 3.375 0 1 1-6.75 0v-3.5A3.383 3.383 0 0 1 12 6.875c1.172 0 2.294.603 2.931 1.542A1.124 1.124 0 0 1 13.07 9.68 1.34 1.34 0 0 0 12 9.125c-.62 0-1.125.515-1.125 1.125v.07a3.375 3.375 0 0 1 4.5 3.18z"
      />
    </svg>
  );
}
