import type { SVGProps } from "react";
export interface CreditCardXmarkIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardXmarkIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CreditCardXmarkIconProps) {
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
        d="M21.204 15.205a1.125 1.125 0 0 1 1.59 1.59L21.09 18.5l1.705 1.705.078.087a1.124 1.124 0 0 1-1.582 1.582l-.087-.078L19.5 20.09l-1.704 1.705a1.125 1.125 0 1 1-1.59-1.59l1.703-1.706-1.703-1.704-.078-.085a1.125 1.125 0 0 1 1.583-1.583l.085.078 1.704 1.703zm-.33-3.206V7A1.874 1.874 0 0 0 19 5.125H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h8.128l.116.006a1.125 1.125 0 0 1 0 2.239l-.116.005H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7v5a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
