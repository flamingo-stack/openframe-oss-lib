import type { SVGProps } from "react";
export interface MobilePhoneSignalOutIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneSignalOutIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MobilePhoneSignalOutIconProps) {
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
        d="M.875 19V5A4.125 4.125 0 0 1 5 .875h5.001l.114.006a1.125 1.125 0 0 1 0 2.238l-.114.006H5c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h6c1.036 0 1.875-.84 1.875-1.875v-5a1.125 1.125 0 0 1 2.25 0v5A4.125 4.125 0 0 1 11 23.125H5A4.125 4.125 0 0 1 .875 19"
      />
      <path
        fill={color}
        d="m9 17.875.115.005a1.125 1.125 0 0 1 0 2.239L9 20.125H7a1.125 1.125 0 0 1 0-2.25zM16.875 10a2.875 2.875 0 0 0-2.582-2.86l-.408-.02A1.125 1.125 0 0 1 14 4.875l.263.006A5.125 5.125 0 0 1 19.124 10a1.125 1.125 0 0 1-2.25 0Zm4 0a6.875 6.875 0 0 0-6.521-6.866L14 3.125l-.116-.006A1.125 1.125 0 0 1 14 .875l.468.012A9.126 9.126 0 0 1 23.125 10a1.125 1.125 0 0 1-2.25 0m-5.5 0a1.375 1.375 0 0 1-2.743.14l-.007-.14.007-.141a1.375 1.375 0 0 1 1.369-1.234l.14.008c.693.07 1.233.655 1.233 1.367Z"
      />
    </svg>
  );
}
