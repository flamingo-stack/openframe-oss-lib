import type { SVGProps } from "react";
export interface Numer1SquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Numer1SquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Numer1SquareIconProps) {
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
        d="M12.32 6.876c.593.038 1.055.53 1.055 1.124v6.874H14.5l.116.006a1.126 1.126 0 0 1 0 2.239l-.116.006H10a1.125 1.125 0 0 1 0-2.25h1.125v-3.882a3 3 0 0 1-.598.118l-.293.013H10a1.125 1.125 0 0 1 0-2.25h.234l.162-.014a.875.875 0 0 0 .707-.752l.03-.247a1.126 1.126 0 0 1 1.187-.985"
      />
    </svg>
  );
}
