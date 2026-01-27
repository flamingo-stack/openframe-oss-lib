import type { SVGProps } from "react";
export interface HomeAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HomeAltIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HomeAltIconProps) {
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
        d="M19.875 10.5c0-.59-.278-1.146-.75-1.5l-6-4.5a1.875 1.875 0 0 0-2.123-.088l-.127.088-6 4.5c-.472.354-.75.91-.75 1.5V18c0 1.035.84 1.875 1.875 1.875h1.875V16a4.125 4.125 0 1 1 8.25 0v3.875H18l.192-.01A1.875 1.875 0 0 0 19.875 18zm2.25 7.5a4.125 4.125 0 0 1-3.703 4.103l-.422.022h-2.5a1.625 1.625 0 0 1-1.625-1.625V16a1.875 1.875 0 0 0-3.75 0v4.5c0 .842-.64 1.533-1.459 1.616l-.166.009H6A4.125 4.125 0 0 1 1.875 18v-7.5c0-1.298.61-2.521 1.65-3.3l6-4.5.28-.194a4.13 4.13 0 0 1 4.67.194l6 4.5a4.13 4.13 0 0 1 1.65 3.3z"
      />
    </svg>
  );
}
