import type { SVGProps } from "react";
export interface CreditCardMinusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardMinusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: CreditCardMinusIconProps) {
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
        d="m22 18.875.115.006a1.125 1.125 0 0 1 0 2.239l-.115.005h-6a1.126 1.126 0 0 1 0-2.25zm-1.125-2.88V7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h7l.115.006a1.126 1.126 0 0 1 0 2.239l-.114.005H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7v8.996a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
