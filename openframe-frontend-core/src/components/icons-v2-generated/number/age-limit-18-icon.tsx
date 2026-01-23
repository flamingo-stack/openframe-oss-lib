import type { SVGProps } from "react";
export interface AgeLimit18IconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AgeLimit18Icon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AgeLimit18IconProps) {
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
        d="M7.625 16v-5.007c-.193.057-.392.1-.598.118l-.293.013H6.5a1.125 1.125 0 0 1 0-2.25h.234l.162-.014a.875.875 0 0 0 .707-.752l.03-.247A1.126 1.126 0 0 1 9.876 8v8a1.125 1.125 0 0 1-2.25 0Zm7.75-2.25a1.126 1.126 0 1 0-2.251.001 1.126 1.126 0 0 0 2.252-.002Zm3-6.75V5.625H17a1.125 1.125 0 0 1 0-2.25h1.375V2a1.125 1.125 0 0 1 2.25 0v1.375H22a1.125 1.125 0 0 1 0 2.25h-1.375V7a1.125 1.125 0 0 1-2.25 0m-3.45 2.75a.625.625 0 0 0-.625-.625h-.1a.626.626 0 0 0 0 1.25h.1c.345 0 .624-.28.624-.625Zm2.25 0a2.86 2.86 0 0 1-.516 1.638 3.375 3.375 0 1 1-4.82 0A2.876 2.876 0 0 1 14.2 6.875h.1a2.875 2.875 0 0 1 2.874 2.875Z"
      />
    </svg>
  );
}
