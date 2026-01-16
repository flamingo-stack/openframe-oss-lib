import type { SVGProps } from "react";
export interface ThumbsUpIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ThumbsUpIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ThumbsUpIconProps) {
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
        d="M5.875 22V10.5a1.125 1.125 0 0 1 2.25 0V22a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M12.875 4.5c0-.759-.616-1.375-1.376-1.375h-.246L8.04 10.928a1.125 1.125 0 0 1-1.04.697H5c-1.036 0-1.875.84-1.875 1.876V19c0 1.035.84 1.875 1.875 1.875h12.926c.925 0 1.712-.675 1.853-1.59l1.078-7a1.876 1.876 0 0 0-1.855-2.16H14A1.125 1.125 0 0 1 12.875 9zm2.25 3.375h3.877a4.126 4.126 0 0 1 4.108 4.518l-.03.234-1.076 7a4.126 4.126 0 0 1-4.078 3.498H5A4.125 4.125 0 0 1 .875 19v-5.5A4.125 4.125 0 0 1 5 9.376h1.247L9.204 2.19l.067-.145A2.13 2.13 0 0 1 11.17.875h.33A3.626 3.626 0 0 1 15.124 4.5z"
      />
    </svg>
  );
}
