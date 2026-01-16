import type { SVGProps } from "react";
export interface AlphabetNSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetNSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetNSquareIconProps) {
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
        d="M15.624 15.739c0 1.345-1.69 1.847-2.452.858l-.139-.218-2.408-4.576v4.196a1.125 1.125 0 1 1-2.25 0V8.262c0-1.346 1.69-1.847 2.452-.858l.14.218 2.407 4.575V8a1.125 1.125 0 0 1 2.25 0z"
      />
    </svg>
  );
}
