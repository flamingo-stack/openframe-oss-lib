import type { SVGProps } from "react";
export interface WindowIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function WindowIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: WindowIconProps) {
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
        d="M10.876 21v-7.875H3.5a1.125 1.125 0 0 1 0-2.25h7.376V3a1.125 1.125 0 0 1 2.25 0v7.875H20.5l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-7.374V21a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.375 6c0-1.036-.84-1.875-1.875-1.875h-11c-1.036 0-1.875.84-1.875 1.875v13.875h14.75zm2.25 13.875H22l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H2a1.125 1.125 0 0 1 0-2.25h.375V6A4.125 4.125 0 0 1 6.5 1.875h11A4.125 4.125 0 0 1 21.625 6z"
      />
    </svg>
  );
}
