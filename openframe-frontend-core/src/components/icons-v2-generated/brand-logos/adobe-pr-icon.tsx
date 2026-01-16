import type { SVGProps } from "react";
export interface AdobePrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AdobePrIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AdobePrIconProps) {
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
        d="M10.375 10.25c0-.621-.504-1.125-1.125-1.125H8.125v2.25H9.25c.621 0 1.125-.504 1.125-1.125m3.5 5.75v-5a1.12 1.12 0 0 1 1.973-.732 3.7 3.7 0 0 1 1.652-.393 1.125 1.125 0 0 1 0 2.25c-.64 0-1.198.425-1.375 1.036v2.838a1.125 1.125 0 0 1-2.25 0Zm-1.25-5.75a3.375 3.375 0 0 1-3.375 3.375H8.125v2.374a1.125 1.125 0 0 1-2.25 0V8.214c0-.74.6-1.339 1.339-1.339H9.25a3.375 3.375 0 0 1 3.375 3.375"
      />
    </svg>
  );
}
