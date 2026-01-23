import type { SVGProps } from "react";
export interface AgeLimit3IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AgeLimit3Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AgeLimit3IconProps) {
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
        d="M.875 12C.875 5.857 5.856.876 12.001.876q.75 0 1.476.097l.48.074.113.027a1.126 1.126 0 0 1-.392 2.203l-.115-.013-.382-.06a8.876 8.876 0 1 0 7.557 7.233l1.108-.196 1.107-.198a11 11 0 0 1 .172 1.959c0 6.143-4.98 11.123-11.124 11.124C5.856 23.125.875 18.145.875 12m20.774-2.868a1.124 1.124 0 0 1 1.304.91l-2.215.394c-.108-.612.3-1.195.911-1.304"
      />
      <path
        fill={color}
        d="M9.401 13.374a1.126 1.126 0 0 1 1.377.614l.041.109.065.146c.188.339.626.631 1.116.631a1.125 1.125 0 0 0 0-2.25h-.05a1.125 1.125 0 0 1 0-2.25h.1a.625.625 0 1 0 0-1.249h-.1a.63.63 0 0 0-.565.357l-.054.102a1.125 1.125 0 0 1-1.98-1.067l.094-.177a2.87 2.87 0 0 1 2.505-1.465h.1a2.876 2.876 0 0 1 2.36 4.515A3.375 3.375 0 0 1 12 17.125c-1.35 0-2.684-.813-3.223-2.075l-.096-.258-.031-.11a1.126 1.126 0 0 1 .751-1.308M18.375 7V5.625H17a1.126 1.126 0 0 1 0-2.25h1.375V2a1.125 1.125 0 0 1 2.25 0v1.375H22l.115.006a1.126 1.126 0 0 1 0 2.239L22 5.625h-1.376V7a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
