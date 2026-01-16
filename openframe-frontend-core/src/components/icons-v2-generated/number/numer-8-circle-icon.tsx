import type { SVGProps } from "react";
export interface Numer8CircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer8CircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer8CircleIconProps) {
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
        d="M13.125 13.75a1.125 1.125 0 1 0-2.25 0 1.125 1.125 0 0 0 2.25 0m-.45-4a.626.626 0 0 0-.625-.625h-.1a.626.626 0 0 0 0 1.25h.1c.345 0 .625-.28.625-.625m2.25 0a2.86 2.86 0 0 1-.515 1.64 3.375 3.375 0 1 1-4.82 0 2.876 2.876 0 0 1 2.36-4.515h.1a2.876 2.876 0 0 1 2.875 2.875"
      />
    </svg>
  );
}
