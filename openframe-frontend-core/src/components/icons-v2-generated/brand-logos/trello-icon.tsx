import type { SVGProps } from "react";
export interface TrelloIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function TrelloIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: TrelloIconProps) {
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
        d="M19.875 6c0-1.036-.84-1.875-1.875-1.875H6c-1.036 0-1.875.84-1.875 1.875v12c0 1.035.84 1.875 1.875 1.875h12c1.035 0 1.875-.84 1.875-1.875zm2.25 12A4.125 4.125 0 0 1 18 22.125H6A4.125 4.125 0 0 1 1.875 18V6A4.125 4.125 0 0 1 6 1.875h12A4.125 4.125 0 0 1 22.125 6z"
      />
      <path
        fill={color}
        d="M7.625 15.875h1.5v-8.25h-1.5zm7.25-5h1.5v-3.25h-1.5zm-3.5 5.625c0 .898-.727 1.625-1.625 1.625H7A1.625 1.625 0 0 1 5.375 16.5V7c0-.898.727-1.625 1.625-1.625h2.75c.898 0 1.625.727 1.625 1.625zm7.25-5c0 .897-.727 1.626-1.625 1.626h-2.75a1.627 1.627 0 0 1-1.626-1.627V7c0-.897.73-1.624 1.627-1.624H17c.897 0 1.624.727 1.625 1.625z"
      />
    </svg>
  );
}
