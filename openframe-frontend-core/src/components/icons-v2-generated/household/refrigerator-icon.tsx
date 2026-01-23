import type { SVGProps } from "react";
export interface RefrigeratorIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function RefrigeratorIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: RefrigeratorIconProps) {
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
        d="M7.375 14v-1a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0M19 8.874l.115.006a1.125 1.125 0 0 1 0 2.239l-.115.006H5a1.125 1.125 0 0 1 0-2.25zM7.375 7V6a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.875 5c0-1.036-.84-1.875-1.876-1.875H8c-1.036 0-1.875.84-1.875 1.875v14c0 1.035.84 1.875 1.875 1.875h8c1.035 0 1.875-.84 1.875-1.875zm2.25 14a4.125 4.125 0 0 1-4.126 4.125H8A4.125 4.125 0 0 1 3.875 19V5A4.125 4.125 0 0 1 8 .875h8A4.125 4.125 0 0 1 20.124 5v14Z"
      />
    </svg>
  );
}
