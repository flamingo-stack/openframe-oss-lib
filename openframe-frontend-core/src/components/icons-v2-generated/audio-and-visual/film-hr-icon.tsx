import type { SVGProps } from "react";
export interface FilmHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FilmHrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FilmHrIconProps) {
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
        d="M15.875 21v-7.875h-7.75V21a1.125 1.125 0 0 1-2.25 0v-4.875H2a1.125 1.125 0 0 1 0-2.25h3.875v-3.75H2a1.125 1.125 0 0 1 0-2.25h3.875V3a1.125 1.125 0 0 1 2.25 0v7.875h7.75V3a1.125 1.125 0 0 1 2.25 0v4.875H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-3.875v3.75H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-3.875V21a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 6c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18V6A4.125 4.125 0 0 1 5 1.875h14A4.125 4.125 0 0 1 23.125 6z"
      />
    </svg>
  );
}
