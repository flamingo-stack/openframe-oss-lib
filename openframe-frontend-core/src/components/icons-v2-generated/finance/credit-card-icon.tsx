import type { SVGProps } from "react";
export interface CreditCardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CreditCardIconProps) {
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
        d="m9 11.874.115.006a1.126 1.126 0 0 1 0 2.239L9 14.124H6a1.125 1.125 0 0 1 0-2.25zm13-4.999.115.006a1.125 1.125 0 0 1 0 2.238L22 9.125H2a1.125 1.125 0 0 1 0-2.25z"
      />
      <path
        fill={color}
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
    </svg>
  );
}
