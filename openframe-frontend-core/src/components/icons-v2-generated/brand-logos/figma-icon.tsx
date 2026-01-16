import type { SVGProps } from "react";
export interface FigmaIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FigmaIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: FigmaIconProps) {
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
        d="M10.875 16.125H9A1.875 1.875 0 1 0 10.875 18zm6-4.125a1.875 1.875 0 1 0-3.75 0 1.875 1.875 0 0 0 3.75 0m2.25 0A4.125 4.125 0 0 1 15 16.125a4.1 4.1 0 0 1-1.875-.456V18A4.125 4.125 0 1 1 9 13.875h2.33a4.1 4.1 0 0 1 0-3.75H9a4.125 4.125 0 0 1 0-8.25h3c.621 0 1.125.504 1.125 1.125v5.33A4.1 4.1 0 0 1 15 7.874 4.125 4.125 0 0 1 19.125 12m-12-6c0 1.036.84 1.875 1.875 1.875h1.875v-3.75H9c-1.036 0-1.875.84-1.875 1.875"
      />
      <path
        fill={color}
        d="M16.875 6c0-1.036-.84-1.875-1.875-1.875h-1.875v3.75H15c1.036 0 1.875-.84 1.875-1.875m-9.75 6c0 1.036.84 1.875 1.875 1.875h1.875v-3.75H9c-1.036 0-1.875.84-1.875 1.875m12-6A4.125 4.125 0 0 1 15 10.125h-1.875V15c0 .621-.504 1.125-1.125 1.125H9a4.125 4.125 0 1 1 0-8.25h1.875V3l.006-.116A1.125 1.125 0 0 1 12 1.875h3A4.125 4.125 0 0 1 19.125 6"
      />
    </svg>
  );
}
