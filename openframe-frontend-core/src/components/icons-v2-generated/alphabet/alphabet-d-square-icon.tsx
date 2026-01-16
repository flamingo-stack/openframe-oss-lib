import type { SVGProps } from "react";
export interface AlphabetDSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetDSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetDSquareIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M13.375 10.5c0-.759-.616-1.375-1.376-1.375h-.874v5.75h.874c.76 0 1.376-.615 1.376-1.374zm2.25 3a3.625 3.625 0 0 1-3.626 3.625h-1.748c-.76 0-1.376-.615-1.376-1.374v-7.5c0-.76.616-1.376 1.376-1.376h1.748a3.626 3.626 0 0 1 3.626 3.626z"
      />
    </svg>
  );
}
