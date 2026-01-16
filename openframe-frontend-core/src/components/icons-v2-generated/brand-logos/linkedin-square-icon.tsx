import type { SVGProps } from "react";
export interface LinkedinSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function LinkedinSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: LinkedinSquareIconProps) {
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
        d="M5.875 17v-7a1.125 1.125 0 1 1 2.25 0v7a1.125 1.125 0 0 1-2.25 0m10 0v-4a1.875 1.875 0 0 0-3.74-.192l-.01.192v4a1.125 1.125 0 0 1-2.25 0v-7c0-.621.504-1.125 1.126-1.125.407 0 .76.218.958.542A4.125 4.125 0 0 1 18.126 13v4a1.125 1.125 0 0 1-2.25 0Zm-10-10v-.01a1.125 1.125 0 0 1 2.25 0V7a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
