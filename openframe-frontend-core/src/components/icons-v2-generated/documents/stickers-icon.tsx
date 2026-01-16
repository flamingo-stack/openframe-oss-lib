import type { SVGProps } from "react";
export interface StickersIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function StickersIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: StickersIconProps) {
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
        d="M.875 18V9A8.126 8.126 0 0 1 9 .875h9l.115.006a1.125 1.125 0 0 1 0 2.238L18 3.125H9A5.876 5.876 0 0 0 3.124 9v9a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M20.875 9c0-1.035-.84-1.875-1.875-1.875H9c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h3.874V18A4.125 4.125 0 0 1 17 13.875h3.875zm-5.75 10.52 3.881-3.395H17c-1.036 0-1.876.84-1.876 1.875zm8-4.974c0 .536-.203 1.05-.562 1.44l-.164.16-7.376 6.454a2.13 2.13 0 0 1-1.399.525H9A4.125 4.125 0 0 1 4.875 19V9A4.125 4.125 0 0 1 9 4.875h10A4.125 4.125 0 0 1 23.125 9z"
      />
    </svg>
  );
}
