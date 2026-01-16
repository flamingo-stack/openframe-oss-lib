import type { SVGProps } from "react";
export interface ClapperboardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ClapperboardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: ClapperboardIconProps) {
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
        d="M15.497 1.994a1.126 1.126 0 0 1 1.453.402l.057.102 1.689 3.377H21l.116.006a1.125 1.125 0 0 1 0 2.239L21 8.125H3a1.125 1.125 0 0 1 0-2.25h3.18L4.994 3.502l-.046-.105a1.125 1.125 0 0 1 2.001-1l.057.1 1.69 3.378h2.484L9.993 3.502l-.045-.105a1.125 1.125 0 0 1 2.002-1l.056.1 1.69 3.378h2.485l-1.187-2.373-.047-.105a1.125 1.125 0 0 1 .55-1.403"
      />
      <path
        fill={color}
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
    </svg>
  );
}
