import type { SVGProps } from "react";
export interface AlphabetESquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetESquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetESquareIconProps) {
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
        d="M14.25 6.875a1.125 1.125 0 0 1 0 2.25h-3.375v1.5h2.876l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006h-2.876v2h3.375l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006H10a1.375 1.375 0 0 1-1.375-1.374v-7.5c0-.76.616-1.376 1.376-1.376z"
      />
    </svg>
  );
}
