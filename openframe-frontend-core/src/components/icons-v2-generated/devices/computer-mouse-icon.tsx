import type { SVGProps } from "react";
export interface ComputerMouseIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function ComputerMouseIcon({
  className = "",
  size = 24,
  color = "currentColor",
  ...props
}: ComputerMouseIconProps) {
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
        d="M8.253 4.258a8.125 8.125 0 1 1 11.49 11.49l-3.995 3.995a8.125 8.125 0 0 1-11.49-11.49zm9.9 1.59a5.875 5.875 0 0 0-8.31 0L5.85 9.844a5.875 5.875 0 0 0 8.309 8.309l3.994-3.995a5.875 5.875 0 0 0 0-8.308Z"
      />
      <path
        fill={color}
        d="M15.204 7.205a1.125 1.125 0 0 1 1.591 1.59l-2 2a1.125 1.125 0 1 1-1.59-1.59l2-2Z"
      />
    </svg>
  );
}
