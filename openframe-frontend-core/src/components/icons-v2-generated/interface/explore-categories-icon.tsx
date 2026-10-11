import type { SVGProps } from "react";
export interface ExploreCategoriesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ExploreCategoriesIcon({
  className = "",
  size = 24,
  color = "var(--color-text-primary)",
  ...props
}: ExploreCategoriesIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill={color}
      viewBox="0 0 21 21"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M18 16.125v-2c0-1.036-.84-1.875-1.875-1.875h-.876L9.92 17.578a1.126 1.126 0 0 1-1.59-1.591l7.07-7.071a1.876 1.876 0 0 0 0-2.653L13.986 4.85a1.875 1.875 0 0 0-2.652 0L9.922 6.263a1.125 1.125 0 0 1-1.59-1.59l1.413-1.414a4.124 4.124 0 0 1 5.833 0l1.415 1.413.282.314a4.124 4.124 0 0 1 .017 5.184 4.12 4.12 0 0 1 2.959 3.955v2a4.125 4.125 0 0 1-4.125 4.125h-11a1.125 1.125 0 1 1 0-2.25h11C17.16 18 18 17.16 18 16.125" />
      <path d="M8 4.125C8 3.089 7.16 2.25 6.125 2.25h-2c-1.036 0-1.875.84-1.875 1.875v12C2.25 17.16 3.09 18 4.125 18h2C7.16 18 8 17.16 8 16.125zm-1.25 11a1.626 1.626 0 0 1-3.242.166l-.008-.167.008-.165A1.626 1.626 0 0 1 5.125 13.5l.166.009c.82.083 1.459.774 1.459 1.615m3.5 1a4.125 4.125 0 0 1-4.125 4.125h-2A4.125 4.125 0 0 1 0 16.125v-12A4.125 4.125 0 0 1 4.125 0h2a4.125 4.125 0 0 1 4.124 4.125z" />
    </svg>
  );
}
