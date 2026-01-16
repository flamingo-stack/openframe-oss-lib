import type { SVGProps } from "react";
export interface Arrow01DownIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Arrow01DownIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Arrow01DownIconProps) {
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
        d="M10.875 19V5a1.125 1.125 0 0 1 2.25 0v14a1.125 1.125 0 1 1-2.25 0"
      />
      <path
        fill={color}
        d="M17.204 12.205a1.125 1.125 0 1 1 1.591 1.59l-6 6c-.439.44-1.151.44-1.59 0l-6-6-.078-.085a1.126 1.126 0 0 1 1.583-1.583l.085.078L12 17.409z"
      />
    </svg>
  );
}
