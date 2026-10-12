import type { SVGProps } from "react";
export interface MenuIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MenuIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: MenuIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke={color}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      {...props}
    >
      <path d="M4 12h16M4 6h16M4 18h16" />
    </svg>
  );
}
