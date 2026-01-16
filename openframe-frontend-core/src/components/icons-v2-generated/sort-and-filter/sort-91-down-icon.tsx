import type { SVGProps } from "react";
export interface Sort91DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Sort91DownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Sort91DownIconProps) {
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
        d="M17.705 13.705a1.125 1.125 0 0 1 1.92.796v5.374H21l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-5a1.125 1.125 0 0 1 0-2.25h1.375v-2.66l-.08.08a1.125 1.125 0 0 1-1.59-1.59zm2.17-8.205a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0c0 .663-.181 1.281-.491 1.815q-.022.045-.047.087l-2.634 4.197a1.126 1.126 0 0 1-1.906-1.197l.837-1.333a3.623 3.623 0 0 1 .616-7.194A3.625 3.625 0 0 1 22.125 5.5M5.875 3v15.284l-2.08-2.08a1.125 1.125 0 0 0-1.59 1.59l4 4.001.085.078c.442.36 1.094.334 1.506-.078l3.999-4 .078-.085a1.126 1.126 0 0 0-1.582-1.582l-.087.076-2.079 2.08V3a1.125 1.125 0 0 0-2.25 0"
      />
    </svg>
  );
}
