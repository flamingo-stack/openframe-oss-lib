import type { SVGProps } from "react";
export interface Copy01IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Copy01Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: Copy01IconProps) {
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
        d="M14.874 8V5a1.874 1.874 0 0 0-1.875-1.875H5c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.874 1.875 1.874h3l.116.006a1.126 1.126 0 0 1 0 2.239L8 17.125H5a4.125 4.125 0 0 1-4.125-4.126V5A4.125 4.125 0 0 1 5 .875h8A4.125 4.125 0 0 1 17.124 5v3a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M20.875 11c0-1.036-.84-1.875-1.875-1.875h-8c-1.036 0-1.875.84-1.875 1.875v8c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.875-.84 1.875-1.875zm2.25 8A4.125 4.125 0 0 1 19 23.125h-8A4.125 4.125 0 0 1 6.875 19v-8A4.125 4.125 0 0 1 11 6.875h8A4.125 4.125 0 0 1 23.125 11z"
      />
    </svg>
  );
}
