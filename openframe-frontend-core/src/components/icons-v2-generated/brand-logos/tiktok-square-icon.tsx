import type { SVGProps } from "react";
export interface TiktokSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TiktokSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TiktokSquareIconProps) {
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
        d="M5.875 14.5A4.125 4.125 0 0 1 10 10.373a1.125 1.125 0 0 1 0 2.25 1.875 1.875 0 1 0 1.875 1.875V6.5a1.125 1.125 0 0 1 2.25 0 2.876 2.876 0 0 0 2.581 2.86l.294.015.115.006a1.126 1.126 0 0 1 0 2.239l-.114.006-.264-.008a5.1 5.1 0 0 1-2.612-.876V14.5a4.125 4.125 0 1 1-8.25 0"
      />
    </svg>
  );
}
