import type { SVGProps } from "react";
export interface ChatQuoteIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ChatQuoteIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ChatQuoteIconProps) {
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
        d="M4.133 4.133c4.344-4.345 11.39-4.345 15.734 0s4.344 11.39 0 15.734c-3.477 3.477-8.68 4.17-12.847 2.084l-3.17.762c-1.543.37-2.933-1.02-2.563-2.562l.76-3.173C-.037 12.812.657 7.609 4.133 4.133m14.143 1.592a8.875 8.875 0 0 0-12.55 0 8.88 8.88 0 0 0-1.5 10.562c.136.245.175.534.109.807l-.813 3.382 3.385-.811.207-.03c.207-.01.415.038.599.14a8.875 8.875 0 0 0 10.563-14.05"
      />
      <path
        fill={color}
        d="M15.125 11.374h1.25v-1.249h-1.25zm-7.5 0h1.25v-1.249h-1.25zm3.5 1.584a4.716 4.716 0 0 1-3.94 4.652l-.115.014a1.126 1.126 0 0 1-.255-2.234l.22-.046a2.47 2.47 0 0 0 1.749-1.72H7A1.625 1.625 0 0 1 5.375 12V9.5c0-.898.728-1.625 1.625-1.625h2.5c.897 0 1.624.727 1.625 1.625zm7.5 0a4.716 4.716 0 0 1-3.94 4.652l-.115.014a1.126 1.126 0 0 1-.255-2.234l.22-.046a2.47 2.47 0 0 0 1.749-1.72H14.5A1.625 1.625 0 0 1 12.875 12V9.5c0-.898.727-1.625 1.625-1.625H17c.897 0 1.624.727 1.625 1.625z"
      />
    </svg>
  );
}
