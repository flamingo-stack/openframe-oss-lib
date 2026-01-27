import type { SVGProps } from "react";
export interface BasketArrowDownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function BasketArrowDownIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: BasketArrowDownIconProps) {
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
        d="M10.874 12a1.125 1.125 0 0 1 2.25 0v3.285l1.08-1.08a1.125 1.125 0 1 1 1.59 1.591l-3 3c-.439.439-1.15.44-1.59 0l-3-3-.076-.086a1.124 1.124 0 0 1 1.582-1.582l.085.077 1.08 1.08V12ZM8.028 1.434a1.124 1.124 0 0 1 1.944 1.134l-3.5 6a1.124 1.124 0 1 1-1.943-1.134l3.5-6Zm6.404-.404a1.126 1.126 0 0 1 1.477.308l.063.096 3.5 6 .052.103a1.125 1.125 0 0 1-1.933 1.128l-.063-.097-3.5-6-.053-.103a1.125 1.125 0 0 1 .457-1.435"
      />
      <path
        fill={color}
        d="M18.499 6.875a4.126 4.126 0 0 1 4.111 4.462l-.026.232-1.113 8a4.126 4.126 0 0 1-4.087 3.556H6.616a4.125 4.125 0 0 1-4.086-3.556l-1.114-8A4.125 4.125 0 0 1 5.5 6.875h12.998ZM5.5 9.125a1.874 1.874 0 0 0-1.856 2.133l1.113 8c.13.928.922 1.617 1.858 1.617h10.768c.935 0 1.728-.69 1.857-1.616l1.115-8 .018-.21a1.876 1.876 0 0 0-1.875-1.924z"
      />
    </svg>
  );
}
