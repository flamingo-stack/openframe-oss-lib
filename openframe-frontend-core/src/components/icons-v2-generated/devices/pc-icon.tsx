import type { SVGProps } from "react";
export interface PcIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PcIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: PcIconProps) {
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
        d="M20.875 6c0-1.035-.84-1.875-1.875-1.875h-4c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h4c1.036 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 19 22.125h-4A4.125 4.125 0 0 1 10.875 18V6A4.125 4.125 0 0 1 15 1.875h4A4.125 4.125 0 0 1 23.125 6z"
      />
      <path
        fill={color}
        d="m8 19.875.116.006a1.125 1.125 0 0 1 0 2.239L8 22.125H6a1.125 1.125 0 0 1 0-2.25zM.875 14V8A4.125 4.125 0 0 1 5 3.875h3l.116.006a1.125 1.125 0 0 1 0 2.238L8 6.125H5c-1.036 0-1.875.84-1.875 1.875v6c0 1.036.84 1.875 1.875 1.875h3l.116.006a1.125 1.125 0 0 1 0 2.238L8 18.125H5A4.125 4.125 0 0 1 .875 14m17 1a.875.875 0 1 0-1.751 0 .875.875 0 0 0 1.75 0Zm.5-7a1.376 1.376 0 0 1-2.743.14L15.624 8l.008-.14A1.376 1.376 0 0 1 17 6.624l.14.007c.694.07 1.235.656 1.235 1.368Zm1.75 7a3.125 3.125 0 1 1-6.25 0 3.125 3.125 0 0 1 6.25 0"
      />
    </svg>
  );
}
