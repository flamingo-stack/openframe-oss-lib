import type { SVGProps } from "react";
export interface PassportIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function PassportIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: PassportIconProps) {
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
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875H7c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V5A4.125 4.125 0 0 1 7 .875h10A4.125 4.125 0 0 1 21.125 5z"
      />
      <path
        fill={color}
        d="m16 16.875.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H8a1.125 1.125 0 0 1 0-2.25zm-1.126-6.874a2.875 2.875 0 1 0-5.75-.002 2.875 2.875 0 0 0 5.75.002m2.25 0a5.124 5.124 0 1 1-10.248 0 5.124 5.124 0 0 1 10.248 0"
      />
    </svg>
  );
}
