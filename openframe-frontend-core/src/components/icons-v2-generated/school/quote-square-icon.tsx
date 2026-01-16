import type { SVGProps } from "react";
export interface QuoteSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function QuoteSquareIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: QuoteSquareIconProps) {
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
        d="M15.125 10.874h1.25V9.625h-1.25zm-7.5 0h1.25V9.625h-1.25zm3.5 1.584a4.716 4.716 0 0 1-3.94 4.652l-.115.014a1.126 1.126 0 0 1-.255-2.234l.22-.046a2.47 2.47 0 0 0 1.749-1.72H7A1.625 1.625 0 0 1 5.375 11.5V9c0-.898.727-1.625 1.625-1.625h2.5c.897 0 1.624.727 1.624 1.625zm7.5 0a4.716 4.716 0 0 1-3.94 4.652l-.115.014a1.126 1.126 0 0 1-.255-2.234l.22-.046a2.47 2.47 0 0 0 1.749-1.72H14.5a1.625 1.625 0 0 1-1.625-1.624V9c0-.898.727-1.625 1.624-1.625H17c.897 0 1.624.727 1.625 1.625z"
      />
    </svg>
  );
}
