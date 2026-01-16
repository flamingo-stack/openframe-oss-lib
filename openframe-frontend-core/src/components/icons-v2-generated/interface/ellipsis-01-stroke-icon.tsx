import type { SVGProps } from "react";
export interface Ellipsis01StrokeIconProps
  extends Omit<SVGProps<SVGSVGElement>, "width" | "height"> {
  className?: string;
  size?: number;
  color?: string;
}
export function Ellipsis01StrokeIcon({
  className = "",
  size = 24,
  color = "#888888",
  ...props
}: Ellipsis01StrokeIconProps) {
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
        d="M20.875 12a.876.876 0 1 0-1.751.002.876.876 0 0 0 1.752-.003Zm2.25 0a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0m-18.25 0a.876.876 0 1 0-1.751.002A.876.876 0 0 0 4.875 12m8 0a.875.875 0 1 0-1.75 0 .875.875 0 0 0 1.75 0m-5.75 0a3.126 3.126 0 1 1-6.25 0 3.126 3.126 0 0 1 6.25 0m8 0a3.126 3.126 0 1 1-6.252 0 3.126 3.126 0 0 1 6.252 0"
      />
    </svg>
  );
}
