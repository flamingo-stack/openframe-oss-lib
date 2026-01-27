import type { SVGProps } from "react";
export interface HardDriveIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function HardDriveIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: HardDriveIconProps) {
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
        d="M20.875 15v-.845c0-.465-.066-.927-.197-1.371l-.152-.44-2.816-7.04a1.88 1.88 0 0 0-1.741-1.179H8.03c-.767 0-1.456.467-1.74 1.18l-2.817 7.04a4.9 4.9 0 0 0-.349 1.81V15a1.125 1.125 0 0 1-2.25 0v-.845c0-.906.173-1.804.51-2.646l2.817-7.041.127-.287A4.13 4.13 0 0 1 8.03 1.875h7.938a4.13 4.13 0 0 1 3.83 2.593l2.816 7.041c.336.842.51 1.74.51 2.646V15a1.125 1.125 0 0 1-2.25 0Z"
      />
      <path
        fill={color}
        d="M20.875 15a.875.875 0 0 0-.875-.875H4a.875.875 0 0 0-.875.875v3c0 1.035.84 1.875 1.875 1.875h14c1.035 0 1.875-.84 1.875-1.875zM10 15.876l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.005H6a1.125 1.125 0 0 1 0-2.25zM19.375 17a1.374 1.374 0 0 1-2.743.141l-.007-.14.007-.141A1.375 1.375 0 0 1 18 15.625l.141.007A1.376 1.376 0 0 1 19.375 17m3.75 1A4.125 4.125 0 0 1 19 22.125H5A4.125 4.125 0 0 1 .875 18v-3A3.125 3.125 0 0 1 4 11.875h16c1.726 0 3.124 1.4 3.125 3.125z"
      />
    </svg>
  );
}
