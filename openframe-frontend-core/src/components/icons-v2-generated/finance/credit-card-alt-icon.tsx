import type { SVGProps } from "react";
export interface CreditCardAltIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function CreditCardAltIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: CreditCardAltIconProps) {
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
        d="M20.875 7c0-1.036-.84-1.875-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v10c0 1.036.84 1.875 1.875 1.875h14c1.035 0 1.874-.84 1.875-1.875zm2.25 10A4.125 4.125 0 0 1 19 21.125H5A4.125 4.125 0 0 1 .875 17V7A4.125 4.125 0 0 1 5 2.875h14A4.125 4.125 0 0 1 23.125 7z"
      />
      <path
        fill={color}
        d="M12.874 14.25c0-.378.064-.742.18-1.082a1.125 1.125 0 1 0 0 2.164 3.4 3.4 0 0 1-.18-1.082m2.25 0c0 .269.095.513.251.706a1.125 1.125 0 1 0-.25-.706Zm4.5 0a3.375 3.375 0 0 1-3.374 3.375c-.642 0-1.24-.183-1.751-.494-.51.31-1.108.494-1.749.494a3.375 3.375 0 1 1 0-6.75 3.35 3.35 0 0 1 1.749.494 3.36 3.36 0 0 1 1.75-.494 3.375 3.375 0 0 1 3.376 3.375Z"
      />
    </svg>
  );
}
