import type { SVGProps } from "react";
export interface AlphabetUIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function AlphabetUIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: AlphabetUIconProps) {
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
        d="M6.375 15.5V4a1.125 1.125 0 0 1 2.25 0v11.5a3.375 3.375 0 0 0 6.75 0V4a1.125 1.125 0 0 1 2.25 0v11.5a5.625 5.625 0 0 1-11.25 0"
      />
    </svg>
  );
}
