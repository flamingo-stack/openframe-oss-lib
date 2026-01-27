import type { SVGProps } from "react";
export interface DegreeCelsiusIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function DegreeCelsiusIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: DegreeCelsiusIconProps) {
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
        d="M6.875 7.5a1.375 1.375 0 1 0-2.75 0 1.375 1.375 0 0 0 2.75 0m2.25 0a3.624 3.624 0 1 1-7.249 0 3.624 3.624 0 0 1 7.249 0m1.75 8v-7c0-3.057 2.495-5.625 5.625-5.625 2.288 0 4.52 1.388 5.41 3.464l.16.424.03.111a1.125 1.125 0 0 1-2.128.693l-.041-.107-.091-.24c-.513-1.183-1.878-2.095-3.34-2.095-1.87 0-3.375 1.543-3.375 3.375v7a3.357 3.357 0 0 0 3.375 3.375c1.56 0 3.009-1.037 3.43-2.334a1.125 1.125 0 0 1 2.14.695c-.752 2.31-3.13 3.89-5.57 3.89a5.607 5.607 0 0 1-5.625-5.626"
      />
    </svg>
  );
}
