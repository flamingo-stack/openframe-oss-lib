import type { SVGProps } from "react";
export interface FacebookSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function FacebookSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: FacebookSquareIconProps) {
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
        d="M9.875 21v-9.5a3.626 3.626 0 0 1 3.626-3.625h2.498l.116.006a1.125 1.125 0 0 1 0 2.238l-.115.006h-2.5c-.759 0-1.375.616-1.375 1.376v1.373H14l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.005h-1.875V21a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
