import type { SVGProps } from "react";
export interface AgeLimit0IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AgeLimit0Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AgeLimit0IconProps) {
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
        d="M13.125 10.25a1.125 1.125 0 0 0-2.25 0v3.5a1.125 1.125 0 0 0 2.25 0zM18.375 7V5.625H17a1.126 1.126 0 0 1 0-2.25h1.375V2a1.125 1.125 0 0 1 2.25 0v1.375H22l.115.006a1.126 1.126 0 0 1 0 2.239L22 5.625h-1.376V7a1.125 1.125 0 0 1-2.25 0Zm-3 6.75a3.375 3.375 0 1 1-6.75 0v-3.5a3.375 3.375 0 1 1 6.75 0z"
      />
    </svg>
  );
}
