import type { SVGProps } from "react";
export interface AlphabetASquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetASquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetASquareIconProps) {
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
        d="M10.225 8.14c.559-1.687 2.99-1.687 3.55 0l.05.175 1.769 7.424.022.113a1.125 1.125 0 0 1-2.178.52l-.033-.112-.39-1.635h-2.031l-.39 1.635a1.125 1.125 0 1 1-2.188-.521l1.77-7.424.05-.174Zm1.296 4.236h.958L12 10.367z"
      />
    </svg>
  );
}
