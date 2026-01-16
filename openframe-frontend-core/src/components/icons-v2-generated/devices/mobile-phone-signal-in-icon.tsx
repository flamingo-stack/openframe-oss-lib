import type { SVGProps } from "react";
export interface MobilePhoneSignalInIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneSignalInIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MobilePhoneSignalInIconProps) {
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
        d="M12.875 13.05V5c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h4.998l.114.005a1.126 1.126 0 0 1 0 2.239l-.114.006H5A4.125 4.125 0 0 1 .875 19V5A4.125 4.125 0 0 1 5 .875h6A4.125 4.125 0 0 1 15.125 5v8.05a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M12.625 21.75a9.125 9.125 0 0 1 9.125-9.125 1.125 1.125 0 0 1 0 2.25 6.875 6.875 0 0 0-6.875 6.875 1.125 1.125 0 0 1-2.25 0m4 0a5.124 5.124 0 0 1 5.125-5.125 1.125 1.125 0 0 1 0 2.25 2.874 2.874 0 0 0-2.875 2.875 1.125 1.125 0 0 1-2.25 0M9 17.875l.115.006a1.125 1.125 0 0 1 0 2.238L9 20.125H7a1.125 1.125 0 0 1 0-2.25zm14.125 3.875a1.376 1.376 0 0 1-2.742.14l-.008-.14.008-.141a1.374 1.374 0 0 1 1.367-1.234l.14.008c.694.07 1.235.655 1.235 1.367"
      />
    </svg>
  );
}
