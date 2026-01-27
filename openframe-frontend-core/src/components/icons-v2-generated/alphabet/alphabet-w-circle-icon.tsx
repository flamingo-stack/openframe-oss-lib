import type { SVGProps } from "react";
export interface AlphabetWCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetWCircleIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: AlphabetWCircleIconProps) {
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
        d="M20.875 12a8.875 8.875 0 1 0-17.75 0 8.875 8.875 0 0 0 17.75 0m2.25 0c0 6.144-4.98 11.124-11.124 11.125S.875 18.145.875 12 5.856.875 12.001.875c6.143 0 11.124 4.981 11.124 11.126Z"
      />
      <path
        fill={color}
        d="M7.829 6.888a1.125 1.125 0 0 1 1.26.828l.023.113.747 4.856.825-2.722.09-.229c.494-.996 1.957-.996 2.451 0l.09.229.826 2.722.747-4.856a1.125 1.125 0 0 1 2.223.342l-1.164 7.575c-.255 1.656-2.512 1.867-3.109.374l-.052-.15-.787-2.591-.784 2.591c-.486 1.604-2.75 1.494-3.13-.069l-.03-.155-1.167-7.575-.012-.114c-.03-.57.377-1.08.953-1.169"
      />
    </svg>
  );
}
