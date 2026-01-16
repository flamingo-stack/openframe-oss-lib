import type { SVGProps } from "react";
export interface HardDrivesIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HardDrivesIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: HardDrivesIconProps) {
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
        d="M20.875 15c0-1.036-.84-1.876-1.875-1.876H5c-1.035 0-1.875.84-1.875 1.875V17c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm0-8c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v2c0 1.035.84 1.874 1.875 1.874h14l.191-.008A1.876 1.876 0 0 0 20.875 9zm2.25 2a4.1 4.1 0 0 1-1.3 3 4.1 4.1 0 0 1 1.3 3v2A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17v-2a4.1 4.1 0 0 1 1.3-3 4.1 4.1 0 0 1-1.3-3V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="m10 14.875.115.006a1.125 1.125 0 0 1 0 2.238l-.114.006H6a1.125 1.125 0 0 1 0-2.25zm0-8 .115.006a1.126 1.126 0 0 1 0 2.239L10 9.125H6a1.125 1.125 0 0 1 0-2.25zM19.376 16a1.376 1.376 0 0 1-2.743.14l-.008-.14.008-.14A1.376 1.376 0 0 1 18 14.623l.14.008c.694.07 1.235.656 1.235 1.368Zm0-8a1.375 1.375 0 0 1-2.743.141l-.008-.14.008-.141a1.375 1.375 0 0 1 2.743.14"
      />
    </svg>
  );
}
