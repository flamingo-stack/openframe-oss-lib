import type { SVGProps } from "react";
export interface XmarkSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function XmarkSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: XmarkSquareIconProps) {
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
        d="M14.705 7.705a1.125 1.125 0 0 1 1.59 1.59L13.59 12l2.706 2.706.076.085a1.125 1.125 0 0 1-1.582 1.582l-.085-.076L12 13.59l-2.704 2.706a1.125 1.125 0 0 1-1.59-1.59l2.704-2.707-2.704-2.704-.078-.085A1.125 1.125 0 0 1 9.21 7.627l.085.078L12 10.409z"
      />
    </svg>
  );
}
