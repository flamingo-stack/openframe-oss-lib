import type { SVGProps } from "react";
export interface AlphabetYCircleIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetYCircleIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetYCircleIconProps) {
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
        d="M10.876 16v-3.26L8.52 8.552l-.051-.104a1.124 1.124 0 0 1 1.95-1.097l.061.097 1.519 2.7 1.52-2.7a1.125 1.125 0 0 1 1.962 1.104l-2.355 4.187v3.26a1.125 1.125 0 0 1-2.25 0Z"
      />
    </svg>
  );
}
