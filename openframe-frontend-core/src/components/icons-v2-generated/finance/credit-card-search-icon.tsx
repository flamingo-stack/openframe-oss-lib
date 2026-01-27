import type { SVGProps } from "react";
export interface CreditCardSearchIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardSearchIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CreditCardSearchIconProps) {
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
        d="M19.875 18a1.876 1.876 0 1 0-3.751.001A1.876 1.876 0 0 0 19.876 18Zm1-5.727V7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h6.289l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7v5.273a1.125 1.125 0 0 1-2.25 0M22.125 18a4.1 4.1 0 0 1-.525 2.008l1.195 1.197.078.085a1.125 1.125 0 0 1-1.582 1.583l-.087-.078L20.01 21.6a4.125 4.125 0 1 1 2.117-3.6Z"
      />
    </svg>
  );
}
