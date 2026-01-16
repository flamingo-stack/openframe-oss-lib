import type { SVGProps } from "react";
export interface CreditCardPlusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardPlusIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CreditCardPlusIconProps) {
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
        d="M17.875 21v-1.875h-1.876a1.125 1.125 0 0 1 0-2.25h1.876v-1.876a1.126 1.126 0 0 1 2.25 0v1.876H22l.115.005a1.125 1.125 0 0 1 0 2.239l-.115.006h-1.875V21a1.125 1.125 0 0 1-2.25 0m3-8.649V7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h7.53l.114.006a1.125 1.125 0 0 1 0 2.239l-.115.005H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7v5.351a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
