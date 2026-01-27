import type { SVGProps } from "react";
export interface AlphabetXSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetXSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetXSquareIconProps) {
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
        d="M10.73 16.552a1.126 1.126 0 0 1-1.96-1.103zm2.54-9.104a1.126 1.126 0 0 1 1.96 1.104L13.29 12l1.94 3.45a1.125 1.125 0 1 1-1.96 1.103L12 14.293l-1.27 2.259-.98-.553-.98-.55 1.94-3.45-1.94-3.447-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.061.097L12 9.705z"
      />
    </svg>
  );
}
