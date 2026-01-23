import type { SVGProps } from "react";
export interface ColorsIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ColorsIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ColorsIconProps) {
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
        d="M19.875 18v-2c0-1.036-.84-1.875-1.875-1.875h-.877l-5.327 5.328a1.125 1.125 0 0 1-1.59-1.591l7.07-7.071a1.876 1.876 0 0 0 0-2.653L15.86 6.725a1.875 1.875 0 0 0-2.652 0l-1.413 1.413a1.125 1.125 0 0 1-1.59-1.59l1.413-1.414a4.124 4.124 0 0 1 5.833 0l1.415 1.413.282.314a4.124 4.124 0 0 1 .017 5.184A4.12 4.12 0 0 1 22.125 16v2A4.125 4.125 0 0 1 18 22.125H7a1.125 1.125 0 1 1 0-2.25h11c1.035 0 1.875-.84 1.875-1.875"
      />
      <path
        fill={color}
        d="M9.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h2c1.035 0 1.875-.84 1.875-1.875zm-1.25 11a1.626 1.626 0 0 1-3.242.166L5.375 17l.008-.166A1.626 1.626 0 0 1 7 15.375l.166.009c.82.083 1.459.774 1.459 1.616m3.5 1A4.125 4.125 0 0 1 8 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h2A4.125 4.125 0 0 1 12.124 6z"
      />
    </svg>
  );
}
