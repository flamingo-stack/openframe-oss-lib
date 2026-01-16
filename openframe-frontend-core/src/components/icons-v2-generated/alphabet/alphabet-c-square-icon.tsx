import type { SVGProps } from "react";
export interface AlphabetCSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetCSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetCSquareIconProps) {
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
        d="M13.222 13.988a1.126 1.126 0 0 1 2.097.805l-.096.257c-.54 1.262-1.872 2.075-3.223 2.075a3.366 3.366 0 0 1-3.375-3.376V10.25A3.383 3.383 0 0 1 12 6.875c1.35 0 2.684.813 3.223 2.074l.096.258.031.111a1.125 1.125 0 0 1-2.128.693l-.041-.107-.065-.148c-.188-.338-.627-.631-1.116-.631-.62 0-1.125.515-1.125 1.125v3.5c0 .628.496 1.124 1.125 1.124.56 0 1.052-.382 1.18-.777z"
      />
    </svg>
  );
}
