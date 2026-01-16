import type { SVGProps } from "react";
export interface MobilePhoneOffIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MobilePhoneOffIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MobilePhoneOffIconProps) {
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
        d="M16.875 12.34V5c0-1.035-.84-1.875-1.875-1.875H9c-.248 0-.482.048-.696.133a1.126 1.126 0 0 1-.838-2.089A4.2 4.2 0 0 1 9 .875h6A4.125 4.125 0 0 1 19.125 5v7.34a1.125 1.125 0 0 1-2.25 0M1.205 1.205a1.125 1.125 0 0 1 1.506-.078l.085.078 20 20 .077.086a1.124 1.124 0 0 1-1.582 1.582l-.087-.078-2.346-2.347A4.12 4.12 0 0 1 15 23.125H9A4.125 4.125 0 0 1 4.876 19V6.466l-3.671-3.67-.078-.085a1.125 1.125 0 0 1 .078-1.506M13 17.875l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-2a1.125 1.125 0 0 1 0-2.25zM7.126 19c0 1.035.84 1.875 1.875 1.875h6c1.035 0 1.875-.84 1.875-1.875v-.534l-9.75-9.75z"
      />
    </svg>
  );
}
