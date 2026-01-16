import type { SVGProps } from "react";
export interface FilmVrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FilmVrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FilmVrIconProps) {
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
        d="M13.875 22v-3.875h-3.75V22a1.125 1.125 0 0 1-2.25 0v-3.875H3a1.125 1.125 0 0 1 0-2.25h7.875v-7.75H3a1.125 1.125 0 0 1 0-2.25h4.875V2a1.125 1.125 0 0 1 2.25 0v3.875h3.75V2a1.125 1.125 0 0 1 2.25 0v3.875H21l.116.005a1.126 1.126 0 0 1 0 2.239L21 8.125h-7.875v7.75H21l.116.006a1.125 1.125 0 0 1 0 2.238l-.116.006h-4.875V22a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.875 5c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 18 23.125H6A4.125 4.125 0 0 1 1.875 19V5A4.125 4.125 0 0 1 6 .875h12A4.125 4.125 0 0 1 22.125 5z"
      />
    </svg>
  );
}
