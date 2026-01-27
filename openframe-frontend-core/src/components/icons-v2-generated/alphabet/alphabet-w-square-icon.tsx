import type { SVGProps } from "react";
export interface AlphabetWSquareIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetWSquareIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetWSquareIconProps) {
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
        d="M7.829 6.888a1.125 1.125 0 0 1 1.26.828l.023.113.747 4.856.825-2.722.09-.229c.494-.996 1.957-.996 2.451 0l.09.229.826 2.722.747-4.856a1.125 1.125 0 0 1 2.223.342l-1.164 7.575c-.255 1.656-2.512 1.867-3.109.374l-.052-.15-.787-2.591-.784 2.591c-.486 1.604-2.75 1.494-3.13-.069l-.03-.155-1.167-7.575-.012-.114c-.03-.57.377-1.08.953-1.169"
      />
    </svg>
  );
}
