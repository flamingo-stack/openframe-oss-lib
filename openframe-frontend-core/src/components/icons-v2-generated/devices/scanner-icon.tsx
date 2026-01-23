import type { SVGProps } from "react";
export interface ScannerIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ScannerIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ScannerIconProps) {
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
        d="M4.875 20v-1.5a1.125 1.125 0 0 1 2.25 0V20a1.125 1.125 0 0 1-2.25 0m12 0v-1.5a1.125 1.125 0 0 1 2.25 0V20a1.125 1.125 0 0 1-2.25 0m-5.75-5.25a1.376 1.376 0 0 1-2.742.14l-.008-.14.008-.14a1.375 1.375 0 0 1 1.367-1.236l.14.008c.694.07 1.235.656 1.235 1.368M2.95 4.596c.21-.544.796-.832 1.346-.681l.108.035 16.086 6.2.105.047a1.126 1.126 0 0 1-.805 2.09l-.109-.038L3.596 6.05l-.106-.047a1.126 1.126 0 0 1-.54-1.407M7.625 14.75a1.376 1.376 0 0 1-2.743.14l-.007-.14.007-.14a1.376 1.376 0 0 1 1.368-1.236l.14.008c.694.07 1.235.656 1.235 1.368"
      />
      <path
        fill={color}
        d="M20.875 14c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v1.5c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zm2.25 1.5A4.125 4.125 0 0 1 19 19.625H5A4.125 4.125 0 0 1 .875 15.5V14A4.125 4.125 0 0 1 5 9.875h14A4.125 4.125 0 0 1 23.125 14z"
      />
    </svg>
  );
}
