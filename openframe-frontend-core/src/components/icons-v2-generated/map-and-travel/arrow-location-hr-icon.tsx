import type { SVGProps } from "react";
export interface ArrowLocationHrIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ArrowLocationHrIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ArrowLocationHrIconProps) {
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
        d="M1.134 5.027c-.933-1.71.729-3.64 2.523-3.04l.174.065L21.525 9.59l.193.09c1.932 1.003 1.868 3.862-.193 4.74L3.83 21.957c-1.858.791-3.66-1.21-2.697-2.975l3.582-6.556a.88.88 0 0 0 0-.841zm5.556 5.477.09.179a3.13 3.13 0 0 1-.09 2.82l-3.408 6.239 17.36-7.392.1-.061a.38.38 0 0 0 0-.569l-.1-.061L3.284 4.266z"
      />
    </svg>
  );
}
