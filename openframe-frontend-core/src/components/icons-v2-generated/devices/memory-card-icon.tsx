import type { SVGProps } from "react";
export interface MemoryCardIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function MemoryCardIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: MemoryCardIconProps) {
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
        d="M18.875 5c0-1.035-.84-1.875-1.875-1.875h-5.758c-.497 0-.974.198-1.326.55L5.674 7.916a1.88 1.88 0 0 0-.549 1.325V19c0 1.035.84 1.875 1.875 1.875h10c1.036 0 1.875-.84 1.875-1.875zm2.25 14A4.125 4.125 0 0 1 17 23.125H7A4.125 4.125 0 0 1 2.875 19V9.242c0-1.094.435-2.143 1.208-2.916l4.243-4.242.303-.274a4.12 4.12 0 0 1 2.613-.935H17A4.125 4.125 0 0 1 21.125 5z"
      />
      <path
        fill={color}
        d="M6.875 10V9a1.125 1.125 0 0 1 2.25 0v1a1.125 1.125 0 0 1-2.25 0m4 0V6a1.125 1.125 0 0 1 2.25 0v4a1.126 1.126 0 0 1-2.25 0m4 0V6a1.125 1.125 0 0 1 2.25 0v4a1.125 1.125 0 0 1-2.25 0"
      />
    </svg>
  );
}
