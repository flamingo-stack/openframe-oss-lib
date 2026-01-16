import type { SVGProps } from "react";
export interface PrinterIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PrinterIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PrinterIconProps) {
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
        d="m18 9.875.116.005a1.126 1.126 0 0 1 0 2.239l-.116.005h-4a1.125 1.125 0 0 1 0-2.25zM16.875 7V5A.875.875 0 0 0 16 4.125H8A.875.875 0 0 0 7.125 5v2a1.125 1.125 0 0 1-2.25 0V5A3.125 3.125 0 0 1 8 1.875h8A3.125 3.125 0 0 1 19.125 5v2a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M18 13.874c.621 0 1.125.505 1.125 1.125v1.87a1.873 1.873 0 0 0 1.75-1.87V10c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v5c0 .993.773 1.805 1.75 1.869v-1.87c0-.62.504-1.125 1.125-1.125zM7.125 19c0 .483.392.875.875.875h8a.875.875 0 0 0 .875-.875v-2.875h-9.75zm16-4a4.12 4.12 0 0 1-4.007 4.119A3.12 3.12 0 0 1 16 22.125H8a3.12 3.12 0 0 1-3.119-3.006 4.12 4.12 0 0 1-4.006-4.12V10A4.125 4.125 0 0 1 5 5.875h14A4.125 4.125 0 0 1 23.125 10z"
      />
    </svg>
  );
}
