import type { SVGProps } from "react";
export interface TShirtIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TShirtIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: TShirtIconProps) {
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
        d="M16.875 10.5a1.125 1.125 0 0 1 1.397-1.091l1.213.303 1.361-2.135-1.693-2.096a4.9 4.9 0 0 0-2.08-1.502l-1.24-.466A4.12 4.12 0 0 1 12 6.125a4.12 4.12 0 0 1-3.835-2.612l-1.238.466A4.9 4.9 0 0 0 5.06 5.234l-.213.247-1.695 2.096 1.36 2.135 1.216-.303A1.125 1.125 0 0 1 7.125 10.5V20c0 .483.391.874.875.875h8a.875.875 0 0 0 .875-.875zm2.25 9.5a3.125 3.125 0 0 1-3.124 3.125H8A3.124 3.124 0 0 1 4.875 20v-8.064a2.12 2.12 0 0 1-2.114-.8l-.098-.139L1.207 8.71a2.13 2.13 0 0 1 .14-2.477l1.75-2.166.31-.36a7.1 7.1 0 0 1 2.73-1.834L8.606.947A1.125 1.125 0 0 1 10.125 2a1.875 1.875 0 1 0 3.75 0l.009-.138a1.125 1.125 0 0 1 1.512-.915l2.466.924.44.183a7.1 7.1 0 0 1 2.601 2.013l1.75 2.166.102.137c.477.697.498 1.619.038 2.34l-1.457 2.287a2.12 2.12 0 0 1-2.21.94V20Z"
      />
    </svg>
  );
}
