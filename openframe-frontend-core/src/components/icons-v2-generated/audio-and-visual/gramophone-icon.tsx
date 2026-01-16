import type { SVGProps } from "react";
export interface GramophoneIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function GramophoneIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: GramophoneIconProps) {
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
        d="M19.875 3.793a22.7 22.7 0 0 1-3.001 2.058c-1.683.952-3.74 1.774-5.874 1.774H9.25a3.124 3.124 0 0 0-3.081 2.611A3.62 3.62 0 0 1 9 8.876h2c2.134 0 4.191.82 5.874 1.772a22.7 22.7 0 0 1 3.002 2.058zm2.25 10.182c0 1.387-1.544 2.052-2.576 1.383l-.2-.151c-.797-.71-2.076-1.747-3.584-2.6-1.52-.861-3.181-1.481-4.765-1.481H9a1.374 1.374 0 0 0-.473 2.663c.231.054.473.086.723.086h1.35a2.526 2.526 0 0 1 2.526 2.526V18.5a1.125 1.125 0 0 1-2.25 0v-2.1a.276.276 0 0 0-.276-.275H9q-.454-.002-.88-.108l-.28-.08-.016-.008A5.373 5.373 0 0 1 9.25 5.375H11c1.583 0 3.244-.62 4.765-1.481 1.508-.854 2.787-1.89 3.585-2.6l.199-.151c1.032-.67 2.576-.005 2.576 1.383z"
      />
      <path
        fill={color}
        d="M18.375 20.5a.875.875 0 0 0-.875-.875h-11a.875.875 0 0 0-.875.875v.375h12.75zm2.25.375H21l.116.005a1.126 1.126 0 0 1 0 2.239l-.116.006H3a1.125 1.125 0 0 1 0-2.25h.375V20.5A3.125 3.125 0 0 1 6.5 17.375h11a3.125 3.125 0 0 1 3.125 3.125z"
      />
    </svg>
  );
}
