import type { SVGProps } from "react";
export interface Expand03IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Expand03Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Expand03IconProps) {
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
        d="M19.875 18v-2a1.125 1.125 0 0 1 2.25 0v2A4.125 4.125 0 0 1 18 22.125h-2a1.125 1.125 0 0 1 0-2.25h2c1.035 0 1.875-.84 1.875-1.875m-18-10V6A4.125 4.125 0 0 1 6 1.875h2l.115.006a1.125 1.125 0 0 1 0 2.238L8 4.125H6c-1.036 0-1.875.84-1.875 1.875v2a1.125 1.125 0 0 1-2.25 0m6.33 6.205a1.125 1.125 0 1 1 1.59 1.59l-4.08 4.08H8.5l.115.006a1.125 1.125 0 0 1 0 2.238l-.115.006H3A1.125 1.125 0 0 1 1.875 21v-5.5a1.125 1.125 0 0 1 2.25 0v2.784l4.08-4.08ZM22.125 8.5a1.125 1.125 0 0 1-2.25 0V5.716l-4.08 4.08a1.125 1.125 0 1 1-1.59-1.591l4.08-4.08h-2.786a1.125 1.125 0 0 1 0-2.25H21c.621 0 1.125.504 1.125 1.125z"
      />
    </svg>
  );
}
