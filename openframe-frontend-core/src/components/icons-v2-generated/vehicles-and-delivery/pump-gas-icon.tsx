import type { SVGProps } from "react";
export interface PumpGasIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PumpGasIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PumpGasIconProps) {
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
        d="M17.875 16.5V13c0-.971-.738-1.77-1.683-1.865l-.192-.01-.116-.006A1.125 1.125 0 0 1 16 8.875l.422.021A4.125 4.125 0 0 1 20.125 13v3.5a.375.375 0 0 0 .75 0V9.44a2.93 2.93 0 0 1-1.5-2.558v-.28l-.999-.666-.092-.069a1.125 1.125 0 0 1 1.24-1.862l.1.059 2.555 1.704.21.16c.464.4.736.986.736 1.608V16.5a2.625 2.625 0 0 1-5.25 0M11.999 4.875c.622 0 1.125.504 1.125 1.125v4c0 .62-.503 1.124-1.125 1.124H7A1.125 1.125 0 0 1 5.875 10V6c0-.62.504-1.125 1.125-1.125zm-3.874 4h2.75v-1.75h-2.75z"
      />
      <path
        fill={color}
        d="M14.874 5a1.874 1.874 0 0 0-1.875-1.875H6c-1.035 0-1.875.84-1.875 1.875v15.875h10.75zm2.25 15.88a1.126 1.126 0 0 1-.008 2.239l-.116.006H2a1.125 1.125 0 0 1-.125-2.245V5A4.125 4.125 0 0 1 6 .875h7A4.125 4.125 0 0 1 17.124 5z"
      />
    </svg>
  );
}
