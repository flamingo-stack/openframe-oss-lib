import type { SVGProps } from "react";
export interface AlphabetYSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetYSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetYSquareIconProps) {
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
        d="M10.876 16v-3.26L8.52 8.552l-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.061.097 1.519 2.7 1.52-2.7a1.125 1.125 0 0 1 1.962 1.104l-2.355 4.187v3.26a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
