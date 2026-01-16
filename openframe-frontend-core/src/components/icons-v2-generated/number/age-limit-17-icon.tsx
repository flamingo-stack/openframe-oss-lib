import type { SVGProps } from "react";
export interface AgeLimit17IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AgeLimit17Icon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AgeLimit17IconProps) {
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
        d="M7.625 16v-5.007c-.193.057-.392.1-.598.118l-.293.013H6.5a1.125 1.125 0 0 1 0-2.25h.234l.162-.014a.875.875 0 0 0 .707-.752l.03-.247A1.126 1.126 0 0 1 9.876 8v8a1.125 1.125 0 0 1-2.25 0Zm5 0c0-2.605 1.056-4.912 2.13-6.875H12a1.125 1.125 0 0 1 0-2.25h4.25c1.062 0 1.714 1.147 1.192 2.058-1.318 2.304-2.567 4.551-2.568 7.066a1.125 1.125 0 0 1-2.25 0Zm5.75-9V5.625H17a1.125 1.125 0 0 1 0-2.25h1.375V2a1.125 1.125 0 0 1 2.25 0v1.375H22l.115.006a1.125 1.125 0 0 1 0 2.239L22 5.625h-1.375V7a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
